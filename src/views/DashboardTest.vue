<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import config from "../assets/config.json";

type LoadState = "loading" | "ready" | "error";
type RoomTone = "free" | "busy" | "scheduled" | "unknown";

interface RoomSlot {
  roomcode: string;
  startTime: string;
  finishTime: string;
  usageStatus?: string | number;
}

interface DashboardPayload {
  schedule_count: number;
  usage_count: number;
  all_rooms_count: number;
  free_rooms_count: number;
  list_empty_rooms: RoomSlot[];
  list_usage_rooms: RoomSlot[];
}

interface RoomRecord {
  id?: number;
  room_no: string;
  panorama?: string | null;
  room_type?: string | null;
  floor_no?: number | null;
  building?: string | null;
  computer_no?: number | null;
  seat_no?: number | null;
}

interface FeatureRecord {
  code?: string;
  application?: string;
  accessory?: string;
  usage?: boolean;
}

interface TeacherRecord {
  prefixname?: string;
  officername?: string;
  officersurname?: string;
  officerlogin?: string;
}

interface ScheduleRecord {
  rowId?: number;
  id?: string | number;
  schedule_id?: string | number;
  roomcode: string;
  coursecode?: string;
  coursename?: string;
  subject_code?: string;
  subject_name?: string;
  schedule_date: string;
  teacher_name?: string | TeacherRecord[];
  userCode?: string;
  user_code?: string;
  user_name?: string;
  user_login?: string;
  startTime: string;
  finishTime: string;
  objective?: string;
  source?: string;
  usage_status?: number | string;
}

interface RoomStatusView {
  roomcode: string;
  tone: RoomTone;
  label: string;
  context: string;
}

interface CalendarDay {
  date: string;
  dayNo: number;
  currentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: ScheduleRecord[];
}

interface PersonCountEvent {
  kind: string;
  room_no: string;
  count: number;
}

const API_BASE = (config.apiRoute ?? "http://localhost:8000/").replace(/\/$/, "");
const dashboard = ref<DashboardPayload | null>(null);
const rooms = ref<RoomRecord[]>([]);
const schedules = ref<ScheduleRecord[]>([]);
const applications = ref<FeatureRecord[]>([]);
const accessories = ref<FeatureRecord[]>([]);
const personCounts = ref(new Map<string, number>());
const state = ref<LoadState>("loading");
const errorMessage = ref("");
const detailLoading = ref(false);
const detailError = ref("");
const selectedRoomCode = ref("");
const selectedDate = ref(localDateKey(new Date()));
const visibleMonth = ref(selectedDate.value.slice(0, 7));
const now = ref(new Date());
const imageFailed = ref(false);
const lastUpdatedAt = ref<Date | null>(null);
const dayButtonRefs = new Map<string, HTMLButtonElement>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let dashboardRefreshTimer: ReturnType<typeof setInterval> | null = null;
let personCountStream: EventSource | null = null;
let detailRequestGeneration = 0;

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMinutes(time: string): number {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function sameRoom(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function roomCodeOf(raw: Record<string, unknown>): string {
  const value = raw.room_no ?? raw.roomNo ?? raw.room_code ?? raw.roomCode ?? raw.roomcode;
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function numberOf(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function stringOf(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function normalizeRooms(payload: unknown): RoomRecord[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const raw = row as Record<string, unknown>;
    const roomNo = roomCodeOf(raw);
    if (!roomNo) return [];
    return [{
      id: numberOf(raw, ["id"]) ?? undefined,
      room_no: roomNo,
      panorama: stringOf(raw, ["panorama"]),
      room_type: stringOf(raw, ["room_type", "roomType", "type"]),
      floor_no: numberOf(raw, ["floor_no", "floorNo", "floor"]),
      building: stringOf(raw, ["building", "building_name", "buildingName"]),
      computer_no: numberOf(raw, ["computer_no", "computerNo", "computers", "computer_count"]),
      seat_no: numberOf(raw, ["seat_no", "seatNo", "seats", "seat_count"]),
    }];
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function normalizeDashboard(payload: unknown): DashboardPayload {
  const raw = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return {
    schedule_count: numberOf(raw, ["schedule_count"]) ?? 0,
    usage_count: numberOf(raw, ["usage_count"]) ?? 0,
    all_rooms_count: numberOf(raw, ["all_rooms_count"]) ?? 0,
    free_rooms_count: numberOf(raw, ["free_rooms_count"]) ?? 0,
    list_empty_rooms: Array.isArray(raw.list_empty_rooms) ? raw.list_empty_rooms as RoomSlot[] : [],
    list_usage_rooms: Array.isArray(raw.list_usage_rooms) ? raw.list_usage_rooms as RoomSlot[] : [],
  };
}

async function loadCoreData(showLoading = true) {
  if (showLoading) state.value = "loading";
  errorMessage.value = "";
  const [dashboardResult, roomsResult, schedulesResult] = await Promise.allSettled([
    fetchJson<unknown>(`${API_BASE}/schedule/get_rooms_dashboard/`),
    fetchJson<unknown>(`${API_BASE}/room/get_all_rooms`),
    fetchJson<unknown>(`${API_BASE}/schedule/get_schedule_from_json/`),
  ]);

  if (dashboardResult.status === "fulfilled") {
    dashboard.value = normalizeDashboard(dashboardResult.value);
    lastUpdatedAt.value = new Date();
  }
  if (roomsResult.status === "fulfilled") rooms.value = normalizeRooms(roomsResult.value);
  if (schedulesResult.status === "fulfilled") {
    schedules.value = Array.isArray(schedulesResult.value) ? schedulesResult.value as ScheduleRecord[] : [];
  }

  if (dashboardResult.status === "rejected") {
    state.value = "error";
    errorMessage.value = "ไม่สามารถโหลดข้อมูลสถานะห้องแบบเรียลไทม์ได้";
  } else {
    state.value = "ready";
  }

  if (!selectedRoomCode.value) {
    selectedRoomCode.value = roomStatuses.value[0]?.roomcode ?? rooms.value[0]?.room_no ?? "";
  }
}

async function loadSelectedRoomFeatures(roomCode: string) {
  const requestGeneration = ++detailRequestGeneration;
  applications.value = [];
  accessories.value = [];
  detailError.value = "";
  if (!roomCode) return;
  detailLoading.value = true;

  const [applicationsResult, accessoriesResult] = await Promise.allSettled([
    fetchJson<FeatureRecord[]>(
      `${API_BASE}/application/get_list_application/?room_no=${encodeURIComponent(roomCode)}`,
    ),
    fetchJson<FeatureRecord[]>(
      `${API_BASE}/accessory/get_list_accessory/?room_no=${encodeURIComponent(roomCode)}`,
    ),
  ]);

  if (requestGeneration !== detailRequestGeneration || !sameRoom(roomCode, selectedRoomCode.value)) return;

  if (applicationsResult.status === "fulfilled" && Array.isArray(applicationsResult.value)) {
    applications.value = applicationsResult.value;
  }
  if (accessoriesResult.status === "fulfilled" && Array.isArray(accessoriesResult.value)) {
    accessories.value = accessoriesResult.value;
  }
  if (applicationsResult.status === "rejected" && accessoriesResult.status === "rejected") {
    detailError.value = "ไม่สามารถโหลดข้อมูลซอฟต์แวร์และอุปกรณ์ได้";
  }
  detailLoading.value = false;
}

function subscribePersonCount() {
  if (typeof EventSource === "undefined") return;
  personCountStream = new EventSource(`${API_BASE}/mqtt-stream/subscribe/`);
  personCountStream.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as PersonCountEvent;
      if (payload.kind !== "person_count" || !payload.room_no || typeof payload.count !== "number") return;
      const next = new Map(personCounts.value);
      next.set(payload.room_no, payload.count);
      personCounts.value = next;
    } catch {
      // Ignore malformed events while preserving the existing SSE connection.
    }
  };
}

const dateLabel = computed(() => now.value.toLocaleDateString("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}));

const timeLabel = computed(() => now.value.toLocaleTimeString("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
}));

const freshnessLabel = computed(() => lastUpdatedAt.value
  ? `อัปเดตล่าสุด ${lastUpdatedAt.value.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`
  : "กำลังเชื่อมต่อข้อมูล");

const nowMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes());

const roomStatuses = computed<RoomStatusView[]>(() => {
  const summary = dashboard.value;
  const codes = new Set(rooms.value.map((room) => room.room_no));
  summary?.list_empty_rooms.forEach((slot) => codes.add(slot.roomcode));
  summary?.list_usage_rooms.forEach((slot) => codes.add(slot.roomcode));

  return [...codes].sort((left, right) => left.localeCompare(right, "th", { numeric: true })).map((roomcode) => {
    const usageSlots = (summary?.list_usage_rooms ?? [])
      .filter((slot) => sameRoom(slot.roomcode, roomcode))
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
    const activeUsage = usageSlots.find((slot) =>
      nowMinutes.value >= toMinutes(slot.startTime) && nowMinutes.value <= toMinutes(slot.finishTime));
    if (activeUsage) {
      const pending = !Number.isNaN(Number(activeUsage.usageStatus)) && Number(activeUsage.usageStatus) < 3;
      return {
        roomcode,
        tone: pending ? "scheduled" : "busy",
        label: pending ? "มีตาราง—ยังไม่ยืนยัน" : "กำลังใช้งาน",
        context: `ถึง ${activeUsage.finishTime} น.`,
      };
    }

    const activeFree = (summary?.list_empty_rooms ?? []).find((slot) =>
      sameRoom(slot.roomcode, roomcode)
      && nowMinutes.value >= toMinutes(slot.startTime)
      && nowMinutes.value <= toMinutes(slot.finishTime));
    if (activeFree) {
      return { roomcode, tone: "free", label: "ว่าง", context: `ว่างถึง ${activeFree.finishTime} น.` };
    }

    const nextUsage = usageSlots.find((slot) => toMinutes(slot.startTime) > nowMinutes.value);
    if (nextUsage) {
      return { roomcode, tone: "scheduled", label: "มีตารางวันนี้", context: `รายการถัดไป ${nextUsage.startTime} น.` };
    }

    return { roomcode, tone: "unknown", label: "ไม่มีข้อมูลสถานะ", context: "ไม่มีรายการถัดไปวันนี้" };
  });
});

const selectedRoom = computed(() =>
  rooms.value.find((room) => sameRoom(room.room_no, selectedRoomCode.value)) ?? null,
);

const selectedRoomStatus = computed(() =>
  roomStatuses.value.find((room) => sameRoom(room.roomcode, selectedRoomCode.value))
  ?? { roomcode: selectedRoomCode.value, tone: "unknown" as const, label: "ไม่มีข้อมูลสถานะ", context: "" },
);

const roomImageUrl = computed(() => {
  const value = selectedRoom.value?.panorama?.trim();
  if (!value || imageFailed.value) return "";
  return /^(https?:|data:|\/)/.test(value) ? value : "";
});

const activeApplications = computed(() =>
  applications.value.filter((item) => item.usage !== false && featureLabel(item)),
);

const activeAccessories = computed(() =>
  accessories.value.filter((item) => item.usage !== false && featureLabel(item)),
);

function featureLabel(item: FeatureRecord): string {
  return (item.application ?? item.accessory ?? item.code ?? "").trim();
}

function personCount(roomcode: string): number | undefined {
  return personCounts.value.get(roomcode);
}

function roomAriaLabel(room: RoomStatusView): string {
  const segments = [
    sameRoom(room.roomcode, selectedRoomCode.value) ? `ห้อง ${room.roomcode} ที่เลือกอยู่` : `เลือกห้อง ${room.roomcode}`,
    `สถานะ ${room.label}`,
    room.context,
  ];
  const count = personCount(room.roomcode);
  if (count !== undefined) segments.push(`ตรวจพบผู้ใช้ ${count} คน`);
  return segments.filter(Boolean).join(", ");
}

const roomSchedules = computed(() => schedules.value.filter((item) =>
  sameRoom(item.roomcode ?? "", selectedRoomCode.value)),
);

const selectedDaySchedules = computed(() => roomSchedules.value
  .filter((item) => item.schedule_date?.slice(0, 10) === selectedDate.value)
  .sort((left, right) => left.startTime.localeCompare(right.startTime)),
);

function addMonths(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const next = new Date(year, monthIndex - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const monthLabel = computed(() => formatMonth(visibleMonth.value));
const selectedDateLabel = computed(() => formatDate(selectedDate.value));

const calendarDays = computed<CalendarDay[]>(() => {
  const [year, monthIndex] = visibleMonth.value.split("-").map(Number);
  const firstOfMonth = new Date(year, monthIndex - 1, 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const today = localDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    return {
      date: key,
      dayNo: date.getDate(),
      currentMonth: key.slice(0, 7) === visibleMonth.value,
      isToday: key === today,
      isSelected: key === selectedDate.value,
      events: roomSchedules.value.filter((item) => item.schedule_date?.slice(0, 10) === key),
    };
  });
});

function setDayRef(date: string, element: Element | null) {
  if (element instanceof HTMLButtonElement) dayButtonRefs.set(date, element);
  else dayButtonRefs.delete(date);
}

function selectDate(date: string) {
  selectedDate.value = date;
  visibleMonth.value = date.slice(0, 7);
}

async function moveSelectedDate(delta: number) {
  const [year, month, day] = selectedDate.value.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + delta);
  selectDate(localDateKey(next));
  await nextTick();
  dayButtonRefs.get(selectedDate.value)?.focus();
}

async function moveSelectedMonth(delta: number) {
  const [year, month, day] = selectedDate.value.split("-").map(Number);
  const targetMonth = new Date(year, month - 1 + delta, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  const next = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(day, lastDay));
  selectDate(localDateKey(next));
  await nextTick();
  dayButtonRefs.get(selectedDate.value)?.focus();
}

function handleDayKeydown(event: KeyboardEvent) {
  const movement: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (event.key in movement) {
    event.preventDefault();
    moveSelectedDate(movement[event.key]);
  } else if (event.key === "PageUp" || event.key === "PageDown") {
    event.preventDefault();
    moveSelectedMonth(event.key === "PageUp" ? -1 : 1);
  }
}

function calendarDayLabel(day: CalendarDay): string {
  const parts = [formatDate(day.date)];
  if (day.isToday) parts.push("วันนี้");
  if (day.isSelected) parts.push("วันที่เลือก");
  parts.push(day.events.length ? `มีรายการ ${day.events.length} รายการ` : "ไม่มีรายการ");
  return parts.join(", ");
}

function scheduleTitle(item: ScheduleRecord): string {
  return item.coursename || item.subject_name || item.coursecode || item.subject_code || item.objective || "รายการจอง";
}

function scheduleOwner(item: ScheduleRecord): string {
  if (Array.isArray(item.teacher_name)) {
    const teacher = item.teacher_name[0];
    if (teacher) return `${teacher.prefixname ?? ""}${teacher.officername ?? ""} ${teacher.officersurname ?? ""}`.trim();
  }
  if (typeof item.teacher_name === "string") return item.teacher_name;
  return item.user_name || item.user_login || item.userCode || item.user_code || "";
}

function scheduleStatus(item: ScheduleRecord): string {
  const status = Number(item.usage_status);
  if (status === 3) return "ยืนยันแล้ว";
  if (status === 4) return "ปิดการใช้งานแล้ว";
  return item.source || "ตามตาราง";
}

function scheduleTone(item: ScheduleRecord): string {
  const status = Number(item.usage_status);
  if (status === 3) return "confirmed";
  if (status === 4) return "closed";
  return "scheduled";
}

watch(selectedRoomCode, (roomCode) => {
  imageFailed.value = false;
  loadSelectedRoomFeatures(roomCode);
});

onMounted(() => {
  loadCoreData();
  subscribePersonCount();
  clockTimer = setInterval(() => { now.value = new Date(); }, 1000);
  dashboardRefreshTimer = setInterval(() => loadCoreData(false), 5 * 60_000);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (dashboardRefreshTimer) clearInterval(dashboardRefreshTimer);
  personCountStream?.close();
  personCountStream = null;
});
</script>

<template>
  <div class="dashboard-test-page">
    <h1 class="sr-only">แดชบอร์ดสถานะและการใช้ห้องคอมพิวเตอร์</h1>

    <section class="overview-grid" aria-label="ภาพรวมสถานะห้อง">
      <div class="overview-main">
        <header class="time-strip">
          <div>
            <p class="date-label">{{ dateLabel }}</p>
            <p class="time-label" aria-label="เวลาปัจจุบัน">{{ timeLabel }}</p>
          </div>
          <div class="live-indicator" aria-label="ข้อมูลสถานะปัจจุบัน">
            <span class="live-dot" :class="{ connected: state === 'ready' }" aria-hidden="true" />
            {{ freshnessLabel }}
          </div>
        </header>

        <section class="kpi-grid" aria-label="สรุปข้อมูลวันนี้">
          <article class="kpi-card kpi-blue">
            <span class="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" /></svg>
            </span>
            <div><p>ห้องทั้งหมด</p><strong>{{ dashboard?.all_rooms_count ?? rooms.length }} <small>ห้อง</small></strong><span>ข้อมูลห้องในระบบ</span></div>
          </article>
          <article class="kpi-card kpi-green">
            <span class="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></svg>
            </span>
            <div><p>ห้องว่างตอนนี้</p><strong>{{ dashboard?.free_rooms_count ?? 0 }} <small>ห้อง</small></strong><span>พร้อมใช้งาน</span></div>
          </article>
          <article class="kpi-card kpi-red">
            <span class="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </span>
            <div><p>กำลังใช้งาน</p><strong>{{ dashboard?.usage_count ?? 0 }} <small>ห้อง</small></strong><span>จากสถานะยืนยัน</span></div>
          </article>
          <article class="kpi-card kpi-amber">
            <span class="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
            </span>
            <div><p>การจองวันนี้</p><strong>{{ dashboard?.schedule_count ?? 0 }} <small>รายการ</small></strong><span>รวมทุกห้อง</span></div>
          </article>
        </section>

        <section class="status-panel" aria-labelledby="room-status-title">
          <div class="section-heading">
            <div>
              <h2 id="room-status-title">สถานะห้องแบบ Real-time</h2>
              <p>เลือกห้องเพื่อดูรายละเอียดและตาราง</p>
            </div>
            <div class="status-legend" aria-label="คำอธิบายสถานะ">
              <span><i class="tone-free" />ว่าง</span>
              <span><i class="tone-busy" />ใช้งาน</span>
              <span><i class="tone-scheduled" />มีตาราง</span>
              <span><i class="tone-unknown" />ไม่มีข้อมูล</span>
            </div>
          </div>

          <div v-if="state === 'loading'" class="panel-state" role="status">กำลังโหลดสถานะห้อง…</div>
          <div v-else-if="state === 'error' && !roomStatuses.length" class="panel-state error" role="alert">
            {{ errorMessage }}
            <button type="button" @click="loadCoreData()">ลองอีกครั้ง</button>
          </div>
          <div v-else-if="!roomStatuses.length" class="panel-state">ไม่มีข้อมูลห้องในระบบ</div>
          <div v-else class="room-grid">
            <button
              v-for="room in roomStatuses"
              :key="room.roomcode"
              type="button"
              class="room-card"
              :class="[`tone-${room.tone}`, { selected: sameRoom(room.roomcode, selectedRoomCode) }]"
              :aria-pressed="sameRoom(room.roomcode, selectedRoomCode)"
              :aria-label="roomAriaLabel(room)"
              @click="selectedRoomCode = room.roomcode"
            >
              <span class="room-card-head">
                <strong>{{ room.roomcode }}</strong>
                <i class="status-dot" aria-hidden="true" />
              </span>
              <span class="room-state-text">{{ room.label }}</span>
              <span class="room-context">{{ room.context }}</span>
              <span v-if="personCount(room.roomcode) !== undefined" class="people-count">
                ตรวจพบ {{ personCount(room.roomcode) }} คน
              </span>
            </button>
          </div>
        </section>
      </div>

      <aside class="room-detail-panel" aria-labelledby="selected-room-title">
        <template v-if="selectedRoomCode">
          <header class="detail-heading">
            <div>
              <h2 id="selected-room-title">{{ selectedRoomCode }}</h2>
              <p>{{ selectedRoom?.room_type || "ไม่มีข้อมูลประเภทห้อง" }}</p>
            </div>
            <span class="status-badge" :class="`tone-${selectedRoomStatus.tone}`">
              <i aria-hidden="true" />{{ selectedRoomStatus.label }}
            </span>
          </header>

          <div class="room-image" :class="{ empty: !roomImageUrl }">
            <img
              v-if="roomImageUrl"
              :src="roomImageUrl"
              :alt="`ภาพห้อง ${selectedRoomCode}`"
              @error="imageFailed = true"
            />
            <div v-else class="image-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9h.01" /></svg>
              <span>ไม่มีรูปห้องในข้อมูลปัจจุบัน</span>
            </div>
          </div>

          <dl class="room-facts">
            <div><dt>อาคาร</dt><dd>{{ selectedRoom?.building || "ไม่มีข้อมูล" }}</dd></div>
            <div><dt>ชั้น</dt><dd>{{ selectedRoom?.floor_no ?? "ไม่มีข้อมูล" }}</dd></div>
            <div><dt>คอมพิวเตอร์</dt><dd>{{ selectedRoom?.computer_no ?? "ไม่มีข้อมูล" }}</dd></div>
            <div><dt>ที่นั่ง</dt><dd>{{ selectedRoom?.seat_no ?? "ไม่มีข้อมูล" }}</dd></div>
          </dl>

          <div class="feature-section">
            <div class="feature-heading"><h3>โปรแกรมที่ติดตั้ง</h3><span>{{ activeApplications.length }}</span></div>
            <p v-if="detailLoading" class="feature-empty" role="status">กำลังโหลด…</p>
            <div v-else-if="activeApplications.length" class="chip-row">
              <span v-for="item in activeApplications.slice(0, 5)" :key="featureLabel(item)" class="feature-chip">{{ featureLabel(item) }}</span>
              <span v-if="activeApplications.length > 5" class="feature-chip more">+{{ activeApplications.length - 5 }}</span>
            </div>
            <p v-else class="feature-empty">ไม่มีข้อมูลโปรแกรม</p>
          </div>

          <div class="feature-section">
            <div class="feature-heading"><h3>อุปกรณ์</h3><span>{{ activeAccessories.length }}</span></div>
            <div v-if="activeAccessories.length" class="chip-row">
              <span v-for="item in activeAccessories.slice(0, 5)" :key="featureLabel(item)" class="feature-chip">{{ featureLabel(item) }}</span>
              <span v-if="activeAccessories.length > 5" class="feature-chip more">+{{ activeAccessories.length - 5 }}</span>
            </div>
            <p v-else class="feature-empty">ไม่มีข้อมูลอุปกรณ์</p>
          </div>
          <p v-if="detailError" class="detail-error" role="alert">{{ detailError }}</p>
        </template>
        <div v-else class="detail-empty">เลือกห้องเพื่อดูรายละเอียด</div>
      </aside>
    </section>

    <section class="lower-grid" aria-label="ปฏิทินและตารางการใช้ห้อง">
      <section class="calendar-panel" aria-labelledby="calendar-title">
        <header class="calendar-heading">
          <div>
            <h2 id="calendar-title">ปฏิทินการใช้ห้อง <span>{{ selectedRoomCode || "—" }}</span></h2>
            <p>{{ monthLabel }}</p>
          </div>
          <div class="calendar-controls" aria-label="ควบคุมเดือนที่แสดง">
            <button type="button" aria-label="เดือนก่อนหน้า" @click="visibleMonth = addMonths(visibleMonth, -1)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" class="today-button" @click="selectDate(localDateKey(new Date()))">วันนี้</button>
            <button type="button" aria-label="เดือนถัดไป" @click="visibleMonth = addMonths(visibleMonth, 1)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </header>
        <p class="sr-only" aria-live="polite">วันที่เลือก {{ selectedDateLabel }} มี {{ selectedDaySchedules.length }} รายการ</p>
        <div class="calendar-grid" :aria-label="`ปฏิทิน ${monthLabel} ห้อง ${selectedRoomCode}`">
          <span v-for="weekday in ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']" :key="weekday" class="weekday">{{ weekday }}</span>
          <button
            v-for="day in calendarDays"
            :key="day.date"
            :ref="(element) => setDayRef(day.date, element as Element | null)"
            type="button"
            class="day-cell"
            :class="{ muted: !day.currentMonth, today: day.isToday, selected: day.isSelected, 'has-events': day.events.length }"
            :aria-pressed="day.isSelected"
            :aria-current="day.isToday ? 'date' : undefined"
            :aria-label="calendarDayLabel(day)"
            :tabindex="day.isSelected ? 0 : -1"
            @click="selectDate(day.date)"
            @keydown="handleDayKeydown"
          >
            <span>{{ day.dayNo }}</span>
            <i v-if="day.events.length" aria-hidden="true">{{ day.events.length }}</i>
          </button>
        </div>
      </section>

      <section class="schedule-panel" aria-labelledby="schedule-title">
        <header class="schedule-heading">
          <div><h2 id="schedule-title">ตารางการใช้ห้อง</h2><p>{{ selectedDateLabel }}</p></div>
          <span>{{ selectedDaySchedules.length }} รายการ</span>
        </header>
        <div v-if="!selectedRoomCode" class="schedule-empty">เลือกห้องเพื่อดูตาราง</div>
        <div v-else-if="!selectedDaySchedules.length" class="schedule-empty">ไม่มีรายการในวันที่เลือก</div>
        <ol v-else class="schedule-list">
          <li v-for="item in selectedDaySchedules" :key="`${item.schedule_id ?? item.id ?? item.rowId}-${item.startTime}`">
            <time>{{ item.startTime }}–{{ item.finishTime }}</time>
            <div><strong>{{ scheduleTitle(item) }}</strong><span v-if="scheduleOwner(item)">{{ scheduleOwner(item) }}</span></div>
            <span class="schedule-state" :class="scheduleTone(item)">{{ scheduleStatus(item) }}</span>
          </li>
        </ol>
      </section>
    </section>
  </div>
</template>

<style scoped>
.dashboard-test-page {
  --dt-page: var(--bg-page, #f1f5f9);
  --dt-surface: var(--bg-surface, #fff);
  --dt-surface-alt: var(--input-bg, #f8fafc);
  --dt-border: var(--border, #d7dee8);
  --dt-text: var(--text-primary, #0f172a);
  --dt-muted: var(--text-secondary, #526174);
  --dt-soft: var(--text-secondary, #475569);
  --dt-blue: #2563eb;
  --dt-blue-soft: #eff6ff;
  --dt-green: #137653;
  --dt-green-soft: #eaf8f1;
  --dt-red: #c53b44;
  --dt-red-soft: #fff0f1;
  --dt-amber: #8a5000;
  --dt-amber-soft: #fff7e8;
  --dt-gray: #5f6f82;
  --dt-panel-shadow: 0 2px 10px rgb(15 23 42 / 0.07);
  display: grid;
  grid-template-rows: minmax(0, 66%) minmax(0, 34%);
  gap: 0.46rem;
  width: 100%;
  height: calc(100dvh - 3.1rem);
  min-width: 0;
  padding: 0.52rem;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--dt-page);
  color: var(--dt-text);
  font-size: 14px;
}

:global(html[data-theme="dark"] .dashboard-test-page) {
  --dt-blue: #60a5fa;
  --dt-blue-soft: #172554;
  --dt-green: #4fbf92;
  --dt-green-soft: #12372c;
  --dt-red: #e97882;
  --dt-red-soft: #421f25;
  --dt-amber: #dca84e;
  --dt-amber-soft: #3d2f18;
  --dt-gray: #94a3b8;
  --dt-panel-shadow: 0 3px 14px rgb(0 0 0 / 0.22);
}

.overview-grid,
.lower-grid {
  display: grid;
  min-width: 0;
  min-height: 0;
  gap: 0.46rem;
}

.overview-grid { grid-template-columns: minmax(0, 67fr) minmax(19rem, 33fr); }
.lower-grid { grid-template-columns: minmax(0, 69fr) minmax(18rem, 31fr); }
.overview-main { display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 0.4rem; min-width: 0; min-height: 0; }

.time-strip,
.kpi-card,
.status-panel,
.room-detail-panel,
.calendar-panel,
.schedule-panel {
  border: 1px solid color-mix(in srgb, var(--dt-border) 78%, transparent);
  border-radius: 12px;
  background: var(--dt-surface);
  box-sizing: border-box;
}

.kpi-card,
.status-panel,
.room-detail-panel,
.calendar-panel,
.schedule-panel { box-shadow: var(--dt-panel-shadow); }

.time-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.75rem;
  padding: 0.18rem 0.55rem;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.date-label,
.time-label,
.kpi-card p,
.kpi-card span,
.section-heading p,
.detail-heading p,
.calendar-heading p,
.schedule-heading p { margin: 0; }

.date-label { color: var(--dt-muted); font-size: 0.75rem; }
.time-label { margin-top: 0.03rem; font-size: 1.62rem; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.live-indicator { display: inline-flex; align-items: center; gap: 0.38rem; color: var(--dt-muted); font-size: 0.72rem; font-weight: 650; }
.live-dot { width: 0.52rem; height: 0.52rem; border-radius: 50%; background: var(--dt-gray); }
.live-dot.connected { background: var(--dt-green); }

.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.38rem; min-width: 0; }
.kpi-card { position: relative; display: grid; grid-template-columns: 2.4rem minmax(0, 1fr); align-items: center; gap: 0.46rem; min-width: 0; min-height: 4.25rem; padding: 0.4rem 0.58rem; overflow: hidden; }
.kpi-card::after { position: absolute; inset: 0 0 auto; height: 2px; background: var(--kpi-accent); content: ""; }
.kpi-icon { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: 10px; background: var(--kpi-soft); }
.kpi-icon svg { width: 1.5rem; height: 1.5rem; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.kpi-card p { overflow: hidden; color: var(--dt-soft); font-size: 0.72rem; font-weight: 650; white-space: nowrap; text-overflow: ellipsis; }
.kpi-card strong { display: block; margin-top: 0.01rem; font-size: 1.55rem; line-height: 1; font-variant-numeric: tabular-nums; }
.kpi-card strong small { color: var(--dt-muted); font-size: 0.68rem; font-weight: 650; }
.kpi-card div > span { display: block; margin-top: 0.11rem; overflow: hidden; color: var(--dt-soft); font-size: 0.66rem; white-space: nowrap; text-overflow: ellipsis; }
.kpi-blue { --kpi-accent: var(--dt-blue); --kpi-soft: var(--dt-blue-soft); }
.kpi-green { --kpi-accent: var(--dt-green); --kpi-soft: var(--dt-green-soft); }
.kpi-red { --kpi-accent: var(--dt-red); --kpi-soft: var(--dt-red-soft); }
.kpi-amber { --kpi-accent: var(--dt-amber); --kpi-soft: var(--dt-amber-soft); }
.kpi-blue .kpi-icon { color: var(--dt-blue); }
.kpi-green .kpi-icon { color: var(--dt-green); }
.kpi-red .kpi-icon { color: var(--dt-red); }
.kpi-amber .kpi-icon { color: var(--dt-amber); }

.status-panel { display: flex; flex-direction: column; min-width: 0; min-height: 0; padding: 0.48rem; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.7rem; margin-bottom: 0.34rem; }
.section-heading h2,
.detail-heading h2,
.calendar-heading h2,
.schedule-heading h2 { margin: 0; color: var(--dt-text); font-size: 0.94rem; line-height: 1.25; font-weight: 800; }
.section-heading p,
.detail-heading p,
.calendar-heading p,
.schedule-heading p { margin-top: 0.08rem; color: var(--dt-soft); font-size: 0.7rem; }
.status-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.25rem 0.65rem; color: var(--dt-muted); font-size: 0.68rem; }
.status-legend span { display: inline-flex; align-items: center; gap: 0.25rem; white-space: nowrap; }
.status-legend i,
.status-badge i { width: 0.45rem; height: 0.45rem; border-radius: 50%; background: currentColor; }
.tone-free { color: var(--dt-green); }
.tone-busy { color: var(--dt-red); }
.tone-scheduled { color: var(--dt-amber); }
.tone-unknown { color: var(--dt-gray); }

.room-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.32rem; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.room-card { position: relative; display: flex; flex-direction: column; align-items: stretch; min-width: 0; min-height: 4.1rem; padding: 0.38rem 0.52rem 0.38rem 0.7rem; overflow: hidden; border: 1px solid var(--dt-border); border-radius: 10px; background: var(--dt-surface); color: var(--dt-text); text-align: left; font: inherit; cursor: pointer; transition: transform 140ms ease-out, border-color 140ms ease-out, background-color 140ms ease-out; }
.room-card::before { position: absolute; inset: 0 auto 0 0; width: 3px; background: currentColor; content: ""; }
.room-card:hover { border-color: color-mix(in srgb, currentColor 55%, var(--dt-border)); background: var(--dt-surface-alt); transform: translateY(-1px); }
.room-card:focus-visible,
.calendar-controls button:focus-visible,
.day-cell:focus-visible,
.panel-state button:focus-visible { outline: 2px solid var(--dt-blue); outline-offset: 2px; }
.room-card.selected { border-color: var(--dt-blue); background: color-mix(in srgb, var(--dt-blue-soft) 52%, var(--dt-surface)); box-shadow: inset 0 0 0 1px var(--dt-blue); }
.room-card.tone-free::before { color: var(--dt-green); }
.room-card.tone-busy::before { color: var(--dt-red); }
.room-card.tone-scheduled::before { color: var(--dt-amber); }
.room-card.tone-unknown::before { color: var(--dt-gray); }
.room-card.tone-free .status-dot,
.room-card.tone-free .room-state-text { color: var(--dt-green); }
.room-card.tone-busy .status-dot,
.room-card.tone-busy .room-state-text { color: var(--dt-red); }
.room-card.tone-scheduled .status-dot,
.room-card.tone-scheduled .room-state-text { color: var(--dt-amber); }
.room-card.tone-unknown .status-dot,
.room-card.tone-unknown .room-state-text { color: var(--dt-gray); }
.room-card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.room-card-head strong { overflow: hidden; font-size: 0.94rem; text-overflow: ellipsis; white-space: nowrap; }
.status-dot { width: 0.52rem; height: 0.52rem; flex: 0 0 auto; border-radius: 50%; background: currentColor; }
.room-state-text { margin-top: 0.09rem; overflow: hidden; font-size: 0.72rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.room-context,
.people-count { margin-top: 0.04rem; overflow: hidden; color: var(--dt-muted); font-size: 0.66rem; text-overflow: ellipsis; white-space: nowrap; }
.people-count { color: var(--dt-blue); font-weight: 650; }

.panel-state,
.detail-empty,
.schedule-empty { display: flex; align-items: center; justify-content: center; flex: 1; min-height: 5rem; color: var(--dt-muted); font-size: 0.78rem; text-align: center; }
.panel-state.error { flex-direction: column; gap: 0.5rem; color: var(--dt-red); }
.panel-state button { border: 1px solid var(--dt-border); border-radius: 6px; padding: 0.35rem 0.6rem; background: var(--dt-surface); color: var(--dt-text); font: inherit; cursor: pointer; }

.room-detail-panel { min-width: 0; min-height: 0; padding: 0.62rem; overflow-y: auto; background: color-mix(in srgb, var(--dt-blue-soft) 20%, var(--dt-surface)); scrollbar-width: thin; }
.detail-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.38rem; }
.detail-heading h2 { font-size: 1.14rem; }
.status-badge { display: inline-flex; align-items: center; gap: 0.32rem; max-width: 55%; padding: 0.28rem 0.52rem; border-radius: 999px; background: var(--dt-surface-alt); font-size: 0.64rem; font-weight: 750; }
.status-badge.tone-free { background: var(--dt-green-soft); }
.status-badge.tone-busy { background: var(--dt-red-soft); }
.status-badge.tone-scheduled { background: var(--dt-amber-soft); }
.status-badge.tone-unknown { background: color-mix(in srgb, var(--dt-gray) 12%, var(--dt-surface)); }
.room-image { display: flex; align-items: center; justify-content: center; width: 100%; height: 8.75rem; min-height: 8.75rem; max-height: 8.75rem; overflow: hidden; border: 1px dashed color-mix(in srgb, var(--dt-blue) 22%, var(--dt-border)); border-radius: 10px; background: color-mix(in srgb, var(--dt-blue-soft) 42%, var(--dt-surface-alt)); }
.room-image img { width: 100%; height: 8.75rem; min-height: 8.75rem; max-height: 8.75rem; object-fit: cover; }
.image-empty { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; color: var(--dt-soft); font-size: 0.68rem; }
.image-empty svg { width: 2.25rem; height: 2.25rem; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.room-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0.4rem 0 0; border-block: 1px solid var(--dt-border); }
.room-facts div { min-width: 0; padding: 0.36rem 0.28rem; text-align: center; }
.room-facts div + div { border-left: 1px solid var(--dt-border); }
.room-facts dt { color: var(--dt-soft); font-size: 0.68rem; }
.room-facts dd { margin: 0.12rem 0 0; overflow: hidden; font-size: 0.74rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.feature-section { margin-top: 0.34rem; }
.feature-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.feature-heading h3 { margin: 0; font-size: 0.74rem; }
.feature-heading > span { color: var(--dt-soft); font-size: 0.68rem; }
.chip-row { display: flex; gap: 0.24rem; margin-top: 0.22rem; overflow: hidden; }
.feature-chip { display: inline-block; max-width: 7.5rem; padding: 0.22rem 0.38rem; overflow: hidden; border: 1px solid var(--dt-border); border-radius: 5px; background: var(--dt-surface-alt); color: var(--dt-muted); font-size: 0.68rem; text-overflow: ellipsis; white-space: nowrap; }
.feature-chip.more { flex: 0 0 auto; color: var(--dt-blue); font-weight: 750; }
.feature-empty,
.detail-error { margin: 0.28rem 0 0; color: var(--dt-soft); font-size: 0.68rem; }
.detail-error { color: var(--dt-red); }

.calendar-panel,
.schedule-panel { min-width: 0; min-height: 0; padding: 0.5rem 0.58rem; overflow: hidden; }
.calendar-heading,
.schedule-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.24rem; }
.calendar-heading h2 span { color: var(--dt-blue); }
.calendar-controls { display: flex; align-items: center; gap: 0.28rem; }
.calendar-controls button { display: inline-flex; align-items: center; justify-content: center; width: 1.65rem; height: 1.65rem; border: 1px solid var(--dt-border); border-radius: 6px; background: var(--dt-surface-alt); color: var(--dt-text); font: inherit; cursor: pointer; }
.calendar-controls .today-button { width: auto; padding-inline: 0.48rem; font-size: 0.66rem; font-weight: 700; }
.calendar-controls svg { width: 0.9rem; height: 0.9rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: auto repeat(6, minmax(1.25rem, 1fr)); gap: 0.12rem; height: calc(100% - 2.35rem); min-height: 0; }
.weekday { align-self: center; padding-block: 0.1rem; color: var(--dt-soft); font-size: 0.68rem; font-weight: 700; text-align: center; }
.day-cell { position: relative; min-width: 0; min-height: 0; border: 1px solid var(--dt-border); border-radius: 6px; background: var(--dt-surface); color: var(--dt-text); font: inherit; font-size: 0.72rem; cursor: pointer; }
.day-cell:hover { border-color: color-mix(in srgb, var(--dt-blue) 55%, var(--dt-border)); background: var(--dt-surface-alt); }
.day-cell.muted { color: var(--dt-soft); }
.day-cell.today { color: var(--dt-blue); font-weight: 800; }
.day-cell.selected { border-color: var(--dt-blue); background: var(--dt-blue-soft); color: #fff; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dt-blue) 28%, transparent); }
.day-cell.selected > span:first-child { display: inline-flex; align-items: center; justify-content: center; width: 1.45rem; height: 1.45rem; border-radius: 50%; background: var(--dt-blue); color: #fff; }
:global(:root[data-theme="dark"]) .day-cell.selected { color: #fff; }
.day-cell.has-events:not(.selected) { border-color: color-mix(in srgb, var(--dt-amber) 36%, var(--dt-border)); }
.day-cell i { position: absolute; right: 0.3rem; bottom: 0.18rem; min-width: 0.38rem; width: 0.38rem; height: 0.38rem; border-radius: 50%; background: var(--dt-amber); color: transparent; font-size: 0; font-style: normal; line-height: 0; }

.schedule-heading > span { padding: 0.24rem 0.42rem; border-radius: 999px; background: var(--dt-blue-soft); color: var(--dt-blue); font-size: 0.6rem; font-weight: 750; white-space: nowrap; }
.schedule-list { display: flex; flex-direction: column; gap: 0.22rem; max-height: calc(100% - 2.35rem); margin: 0; padding: 0; overflow-y: auto; list-style: none; scrollbar-width: thin; }
.schedule-list li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.4rem; min-width: 0; padding: 0.28rem 0.34rem; border: 1px solid var(--dt-border); border-radius: 8px; background: var(--dt-surface-alt); }
.schedule-list time { min-width: 4.7rem; padding: 0.24rem 0.32rem; border-radius: 5px; background: var(--dt-blue); color: #fff; font-size: 0.68rem; font-weight: 800; font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }
.schedule-list div { min-width: 0; }
.schedule-list strong,
.schedule-list div > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.schedule-list strong { font-size: 0.72rem; }
.schedule-list div > span { margin-top: 0.08rem; color: var(--dt-soft); font-size: 0.66rem; }
.schedule-state { padding: 0.2rem 0.34rem; border-radius: 999px; font-size: 0.68rem; font-weight: 750; white-space: nowrap; }
.schedule-state.confirmed { background: var(--dt-green-soft); color: var(--dt-green); }
.schedule-state.closed { background: var(--dt-red-soft); color: var(--dt-red); }
.schedule-state.scheduled { background: var(--dt-amber-soft); color: var(--dt-amber); }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (min-width: 1200px) and (min-height: 700px) {
  .dashboard-test-page { min-height: 0; }
}

@media (max-width: 1199px) {
  .dashboard-test-page { height: auto; min-height: calc(100dvh - 3.1rem); overflow: visible; grid-template-rows: auto auto; }
  .overview-grid { grid-template-columns: minmax(0, 62fr) minmax(18rem, 38fr); }
  .overview-main { min-height: 31rem; }
  .room-detail-panel { max-height: 31rem; }
  .lower-grid { min-height: 18rem; }
}

@media (max-width: 900px) {
  .overview-grid,
  .lower-grid { grid-template-columns: 1fr; }
  .overview-main { min-height: 34rem; }
  .room-detail-panel { max-height: none; }
  .calendar-panel { min-height: 20rem; }
  .schedule-panel { min-height: 12rem; }
}

@media (max-width: 620px) {
  .dashboard-test-page { gap: 0.46rem; min-height: calc(100dvh - 3.35rem); padding: 0.46rem; }
  .overview-main { min-height: 0; grid-template-rows: auto auto auto; }
  .time-strip { min-height: 3.2rem; }
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kpi-card { min-height: 4.25rem; }
  .status-panel { min-height: 23rem; }
  .section-heading { flex-direction: column; }
  .status-legend { justify-content: flex-start; }
  .room-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 18rem; }
  .room-detail-panel { overflow: visible; }
  .room-image,
  .room-image img { max-height: 12rem; }
  .room-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .room-facts div:nth-child(3) { border-left: 0; border-top: 1px solid var(--dt-border); }
  .room-facts div:nth-child(4) { border-top: 1px solid var(--dt-border); }
  .calendar-panel { min-height: 21rem; }
  .schedule-list { max-height: none; }
}

@media (max-width: 390px) {
  .dashboard-test-page { font-size: 13px; }
  .kpi-card { grid-template-columns: 1.9rem minmax(0, 1fr); gap: 0.38rem; padding-inline: 0.42rem; }
  .kpi-icon { width: 1.85rem; height: 1.85rem; }
  .kpi-card strong { font-size: 1.28rem; }
  .room-grid { grid-template-columns: 1fr; }
  .status-panel { min-height: 25rem; }
  .schedule-list li { grid-template-columns: auto minmax(0, 1fr); }
  .schedule-state { grid-column: 2; justify-self: start; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
</style>
