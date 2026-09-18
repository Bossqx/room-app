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
  grid-column: 1;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 0.8rem;
  min-height: 2.65rem;
  padding: 0.42rem 0.75rem;
  border: 1px solid #e1e0d9;
  border-radius: 0.75rem;
  background: #fcfcfb;
  box-sizing: border-box;
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
html[data-theme="dark"] .dash-clock {
  background: #1a1a19;
  border-color: #2c2c2a;
}

.dashboard-split {
  display: grid;
  grid-template-columns: minmax(0, 70%) minmax(20rem, 30%);
  grid-template-rows: auto auto;
  align-items: start;
  column-gap: 0;
  row-gap: 0.65rem;
  width: 100%;
  min-height: calc(100vh - 4rem);
  margin: 0;
  padding: 0.75rem 1rem 0.5rem;
  box-sizing: border-box;
  background: #f5f6f8;
  overflow-x: hidden;
}

.dashboard-col-left {
  grid-column: 1;
  grid-row: 2;
  min-width: 0;
}

.dashboard-col-right {
  grid-column: 2;
  grid-row: 1 / span 2;
  min-width: 0;
  box-sizing: border-box;
  align-self: flex-start;
  height: calc(100vh - 8rem);
  min-height: 28rem;
  max-height: calc(100vh - 8rem);
  overflow: hidden;
  padding-top: 0;
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
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    padding: 0.75rem;
  }
  .dash-clock {
    grid-column: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
  }
  .dashboard-col-left,
  .dashboard-col-right {
    grid-column: 1;
  }
  .dashboard-col-right {
    grid-row: 3;
    height: auto;
    min-height: 0;
    max-height: none;
    overflow: visible;
    padding: 1.5rem 0 0;
  }
}
</style>
