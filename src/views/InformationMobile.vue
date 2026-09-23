<script setup lang="ts">
import { ref } from "vue";
import InfoComponent from "./components/InfoComponent.vue";
import RoomComponent from "./components/RoomComponent.vue";

const selectedRoomNo = ref<string | null>(null);

function selectRoom(roomcode: string) {
  selectedRoomNo.value = roomcode;
}

function closeRoom() {
  selectedRoomNo.value = null;
}
</script>

<template>
  <div class="dashboard-split">
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
.dashboard-split {
  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: calc(100dvh - 108px);
  margin: 0;
  padding: 0;
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
  padding: 3rem 1.1rem 1.1rem;
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
  .dashboard-col-left,
  .dashboard-col-right {
    width: 100%;
  }
}
</style>
