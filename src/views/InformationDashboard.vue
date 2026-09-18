<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import InfoComponent from "./components/InfoComponent.vue";
import RoomComponent from "./components/RoomComponent.vue";

const selectedRoomNo = ref<string | null>(null);

function selectRoom(roomcode: string) {
  selectedRoomNo.value = roomcode;
}

function closeRoom() {
  selectedRoomNo.value = null;
}

// ── Live clock (updates every second) ──
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | null = null;

const dateLabel = computed(() =>
  now.value.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
);
const timeLabel = computed(() =>
  now.value.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }),
);

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<template>
  <div class="dashboard-split">
    <header class="dash-clock">
      <span class="clock-date">{{ dateLabel }}</span>
      <span class="clock-time">{{ timeLabel }}</span>
    </header>
    <div class="dashboard-col dashboard-col-left">
      <InfoComponent @select-room="selectRoom" />
    </div>
    <div class="dashboard-col dashboard-col-right">
      <RoomComponent v-if="selectedRoomNo" :room-no="selectedRoomNo" @close="closeRoom" />
      <div v-else class="placeholder-panel">
        <p class="placeholder-text">Select a room to view details</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Date + time — full-width top-left row spanning both columns */
.dash-clock {
  flex: 0 0 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0 0.5rem 0.75rem;
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif;
}

.clock-date {
  font-size: 0.9rem;
  color: #52514e;
}

.clock-time {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0b0b0b;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1.1;
}

html[data-theme="dark"] .clock-date {
  color: #c3c2b7;
}
html[data-theme="dark"] .clock-time {
  color: #ffffff;
}

.dashboard-split {
  display: flex;
  /* lets .dash-clock take a full-width row above the two columns */
  flex-wrap: wrap;
  align-items: stretch;
  width: 100%;
  min-height: 100vh;
  /* cancel the layout's own .container padding so this page can use its own, larger padding */
  margin: -1rem -2rem -1.5rem;
  /* Top padding sits at 10rem on viewports taller than 80rem (~1040px), then
     grows 1rem for every 1rem of height lost below that, capped at 50rem. */
  padding-top: clamp(10rem, calc(80rem - 100vh), 50rem);
  padding-right: 0.5rem;
  padding-bottom: 0.1rem;
  padding-left: 0.5rem;
  box-sizing: border-box;
  background: #f5f6f8;
}

.dashboard-col-left {
  width: 70%;
  flex-shrink: 0;
}

.dashboard-col-right {
  width: 30%;
  flex-shrink: 0;
  box-sizing: border-box;
   padding-top: 1rem;
  padding-right: 1.1rem;
  padding-bottom: 1.1rem;
  padding-left: 1.1rem;
}

.placeholder-panel {
  height: 100%;
  min-height: 200px;
  background: #fcfcfb;
  border: 1px solid #e1e0d9;
  border-radius: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  color: #898781;
  font-size: 0.85rem;
  margin: 0;
}

@media (max-width: 960px) {
  .dashboard-split {
    flex-direction: column;
  }
  .dash-clock {
    flex: 0 0 auto;
  }
  .dashboard-col-left,
  .dashboard-col-right {
    width: 100%;
  }
  .dashboard-col-right {
    padding: 1.5rem 0 0;
  }
}
</style>
