<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import config from "../../assets/config.json";

const props = defineProps<{
  roomNo: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const apiBase = (config.apiRoute ?? "http://localhost:8000").replace(/\/$/, "");

interface Room {
  id?: number;
  room_no: string;
  panorama?: string | null;
  room_type?: string | null;
  floor_no?: number | null;
  building?: string | null;
  computer_no?: number | null;
  seat_no?: number | null;
}

interface FeatureItem {
  code: string;
  application?: string;
  accessory?: string;
  icon?: string;
  usage?: boolean;
}

interface ScheduleItem {
  schedule_id?: string | number;
  id?: string | number;
  roomcode: string;
  coursecode?: string;
  subject_code?: string;
  subject_name?: string;
  user_login?: string;
  user_name?: string;
  startTime: string;
  finishTime: string;
  schedule_date?: string;
  source?: string;
}

const room = ref<Room | null>(null);
const applications = ref<FeatureItem[]>([]);
const accessories = ref<FeatureItem[]>([]);
const schedules = ref<ScheduleItem[]>([]);
const state = ref<"idle" | "loading" | "error">("idle");
const errorMsg = ref("");

const today = new Date().toISOString().slice(0, 10);

const title = computed(() => room.value?.room_no ?? props.roomNo);

const facts = computed(() => [
  { label: "Type", value: room.value?.room_type || "Not specified" },
  { label: "Building", value: room.value?.building || "Not specified" },
  { label: "Floor", value: room.value?.floor_no ?? "Not specified" },
  { label: "Computers", value: room.value?.computer_no ?? "Not specified" },
  { label: "Seats", value: room.value?.seat_no ?? "Not specified" },
]);

const activeApplications = computed(() =>
  applications.value.filter((item) => item.usage !== false),
);

const activeAccessories = computed(() =>
  accessories.value.filter((item) => item.usage !== false),
);

const orderedSchedules = computed(() =>
  [...schedules.value].sort((a, b) => a.startTime.localeCompare(b.startTime)),
);

function itemLabel(item: FeatureItem): string {
  return (item.application ?? item.accessory ?? item.code ?? "").trim();
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data ?? fallback;
}

async function loadRoomDetails() {
  if (!props.roomNo) return;

  state.value = "loading";
  errorMsg.value = "";
  room.value = null;
  applications.value = [];
  accessories.value = [];
  schedules.value = [];

  try {
    const rooms = await fetchJson<Room[]>(`${apiBase}/room/get_all_rooms`, []);
    room.value = rooms.find((item) => item.room_no === props.roomNo) ?? {
      room_no: props.roomNo,
    };

    const [appResult, accessoryResult, scheduleResult] = await Promise.allSettled([
      fetchJson<FeatureItem[]>(
        `${apiBase}/application/get_list_application/?room_no=${encodeURIComponent(props.roomNo)}`,
        [],
      ),
      fetchJson<FeatureItem[]>(
        `${apiBase}/accessory/get_list_accessory/?room_no=${encodeURIComponent(props.roomNo)}`,
        [],
      ),
      fetchJson<ScheduleItem[]>(
        `${apiBase}/schedule/get_schedule_by_criteria_db/${encodeURIComponent(props.roomNo)}?schedule_date=${today}&source_type=all`,
        [],
      ),
    ]);

    if (appResult.status === "fulfilled") applications.value = appResult.value;
    if (accessoryResult.status === "fulfilled") accessories.value = accessoryResult.value;
    if (scheduleResult.status === "fulfilled") schedules.value = scheduleResult.value;

    state.value = "idle";
  } catch (err) {
    room.value = { room_no: props.roomNo };
    state.value = "error";
    errorMsg.value = `Failed to load room details: ${err}`;
  }
}

onMounted(loadRoomDetails);
watch(() => props.roomNo, loadRoomDetails);
</script>

<template>
  <section class="room-panel">
    <header class="room-header">
      <div>
        <p class="eyebrow">Room details</p>
        <h2>{{ title }}</h2>
      </div>
      <button class="close-btn" type="button" aria-label="Close room details" @click="emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </header>

    <div v-if="state === 'loading'" class="state-box">Loading room details...</div>
    <div v-else>
      <div v-if="state === 'error'" class="error-box">{{ errorMsg }}</div>

      <div class="fact-grid">
        <div v-for="fact in facts" :key="fact.label" class="fact">
          <span>{{ fact.label }}</span>
          <strong>{{ fact.value }}</strong>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Today schedule</h3>
          <span>{{ orderedSchedules.length }}</span>
        </div>
        <div v-if="orderedSchedules.length" class="schedule-list">
          <article
            v-for="item in orderedSchedules"
            :key="`${item.schedule_id ?? item.id ?? item.startTime}-${item.finishTime}`"
            class="schedule-card"
          >
            <div class="time">{{ item.startTime }} - {{ item.finishTime }}</div>
            <div class="subject">
              {{ item.subject_name || item.coursecode || item.subject_code || "Scheduled use" }}
            </div>
            <div v-if="item.user_name || item.user_login" class="owner">
              {{ item.user_name || item.user_login }}
            </div>
          </article>
        </div>
        <p v-else class="empty">No schedule for this room today.</p>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Applications</h3>
          <span>{{ activeApplications.length }}</span>
        </div>
        <div v-if="activeApplications.length" class="chip-list">
          <span v-for="item in activeApplications" :key="item.code" class="chip">{{ itemLabel(item) }}</span>
        </div>
        <p v-else class="empty">No application data.</p>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Accessories</h3>
          <span>{{ activeAccessories.length }}</span>
        </div>
        <div v-if="activeAccessories.length" class="chip-list">
          <span v-for="item in activeAccessories" :key="item.code" class="chip">{{ itemLabel(item) }}</span>
        </div>
        <p v-else class="empty">No accessory data.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.room-panel {
  min-height: 100%;
  background: #fcfcfb;
  border: 1px solid #e1e0d9;
  border-radius: 8px;
  padding: 1rem;
  color: #191816;
  box-shadow: 0 14px 36px rgb(20 20 20 / 0.08);
}

.room-header,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.eyebrow {
  margin: 0 0 0.2rem;
  color: #77746c;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin: 0;
}

h2 {
  font-size: 1.55rem;
  line-height: 1.1;
}

h3 {
  font-size: 0.95rem;
}

.close-btn {
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid #d8d6cd;
  border-radius: 999px;
  background: #fff;
  color: #2d2b27;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.close-btn svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.fact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 1rem;
}

.fact {
  border: 1px solid #eceae3;
  border-radius: 8px;
  padding: 0.7rem;
  background: #fff;
}

.fact span,
.owner,
.empty {
  color: #74716a;
  font-size: 0.78rem;
}

.fact strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.section {
  margin-top: 1rem;
  border-top: 1px solid #ebe9e1;
  padding-top: 0.9rem;
}

.section-head span {
  min-width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #eef4ff;
  color: #1c5ca8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
}

.schedule-list,
.chip-list {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.7rem;
}

.schedule-card {
  border-left: 4px solid #2a78d6;
  border-radius: 8px;
  padding: 0.65rem 0.7rem;
  background: #f6f9ff;
}

.time {
  font-size: 0.78rem;
  color: #1c5ca8;
  font-weight: 800;
}

.subject {
  margin-top: 0.25rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.chip-list {
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
}

.chip {
  min-height: 2rem;
  border-radius: 999px;
  background: #f3f2ee;
  border: 1px solid #e2e0d8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
  overflow-wrap: anywhere;
}

.state-box,
.error-box,
.empty {
  margin-top: 1rem;
}

.state-box,
.error-box {
  border-radius: 8px;
  padding: 0.85rem;
  font-size: 0.85rem;
}

.state-box {
  background: #f3f2ee;
  color: #5f5b51;
}

.error-box {
  background: #fff0f0;
  color: #a32323;
  border: 1px solid #ffd0d0;
}

html[data-theme="dark"] .room-panel {
  background: #1d1d1b;
  border-color: #38352f;
  color: #f6f3eb;
}

html[data-theme="dark"] .close-btn,
html[data-theme="dark"] .fact {
  background: #252420;
  border-color: #3d3932;
  color: #f6f3eb;
}

html[data-theme="dark"] .schedule-card {
  background: #152033;
}

html[data-theme="dark"] .chip {
  background: #2a2925;
  border-color: #3f3b34;
}
</style>
