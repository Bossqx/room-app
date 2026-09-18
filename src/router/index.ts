import { createRouter, createWebHistory } from "vue-router";
import DisplayView from "../views/DisplayView.vue";
import ConfirmSchedule from "../views/confirmSchedule.vue";
import SelfConfirmSchedule from "../views/SelfConfirm.vue";
import Login from "../views/Login.vue";
import BookingSchedule from "../views/BookingScheduleV1.vue";
import ScheduleDesktopV1 from "../views/ScheduleDesktopV1.vue";
import DisplayEmptyRoomsV1 from "../views/DisplayEmptyRoomV1.vue";
import Booking from "../views/Booking.vue";
import StaffAccess from "../views/StaffAccess.vue";
import StaffSumitClose from "../views/StaffSumitClose.vue";
import UserLayoute from "../layouts/UserLayoute.vue";
import PCLayoute from "../layouts/PCLayoute.vue";
import GeneralLayout from "../layouts/GeneralLayout.vue";
import SetFrameLayout from "../layouts/SetFrameLayout.vue";
import SubmitClose from "../views/StaffSumitClose.vue";
import ChangePin from "../views/ChangePin.vue";
import AdminLayout from "../layouts/AdminLayoute.vue";
import AdminMigration from "../views/AdminMigration.vue";
import SemesterManage from "../views/SemesterManage.vue";
import AdminManageSchedule from "../views/AdminManageSchedule.vue";
import Dashboard from "../views/dashboard.vue";
import ScheduleAll from "../views/ScheduleAll.vue";
import ScheduleDashboard from "../views/ScheduleDashboard.vue";
import ScheduleInfo from "../views/ScheduleInfo.vue";
import InformationDashboard from "../views/InformationDashboard.vue";
import InformationMobile from "../views/InformationMobile.vue";
import RoomAdmin from "../views/RoomAdmin.vue";
import FirstDashboard from "../views/First.vue";
import AdminCancelRoom from "../views/AdminCancelRoom.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/qr-front", name: "display", component: DisplayView },
    { path: "/confirm", name: "confirm", component: ConfirmSchedule },
    { path: "/staff-access", name: "staff-access", component: StaffAccess },
    { path: "/login", name: "login", component: Login },
    {
      path: "/staff-close",
      component: SetFrameLayout,
      children: [{ path: "", name: "staff-close", component: StaffSumitClose }],
    },
    {
      path: "/submit-close",
      component: SetFrameLayout,
      children: [{ path: "", name: "submit-close", component: SubmitClose }],
    },
    {
      path: "/",
      component: GeneralLayout,
      children: [
        { path: "", redirect: "/dashboard-first" },
        {
          path: "dashboard-first",
          name: "dashboard-first",
          component: FirstDashboard,
        },
      ],
    },

    {
      path: "/",
      component: UserLayoute,
      children: [
        { path: "", redirect: "/login" },
        {
          path: "mobile/schedule",
          name: "mobile/schedule",
          component: BookingSchedule,
        },
        {
          path: "mobile/empty-rooms",
          name: "mobile/empty-rooms",
          component: DisplayEmptyRoomsV1,
        },
        { path: "mobile/booking", name: "mobile/booking", component: Booking },
        { path: "mobile/home", name: "mobile/home", component: InformationMobile },
        {
          path: "self-confirm",
          name: "self-confirm",
          component: SelfConfirmSchedule,
        },
        {
          path: "/mobile/change-pin",
          name: "/mobile/change-pin",
          component: ChangePin,
        },
      ],
    },
    {
      path: "/desktop",
      component: PCLayoute,
      children: [
        {
          path: "/desktop/schedule",
          name: "/desktop/schedule",
          component: ScheduleDesktopV1,
        },
        {
          path: "/desktop/home",
          name: "/desktop/home",
          component: ScheduleAll,
        },
        {
          path: "/desktop/room-summary",
          name: "/desktop/room-summary",
          component: ScheduleDashboard,
        },
        {
          path: "/desktop/schedule-info",
          name: "/desktop/schedule-info",
          component: ScheduleInfo,
        },
        {
          path: "/desktop/overview",
          name: "/desktop/overview",
          component: InformationDashboard,
        },
      ],
    },

    {
      path: "/admin",
      component: AdminLayout,
      children: [
        { path: "/admin/home", name: "/admin/home", component: AdminMigration },
        {
          path: "/admin/semester",
          name: "/admin/semester",
          component: SemesterManage,
        },
        {
          path: "/admin/schedule",
          name: "/admin/schedule",
          component: AdminManageSchedule,
        },
        {
          path: "/admin/rooms",
          name: "/admin/rooms",
          component: RoomAdmin,
        },
        {
          path: "/admin/cancel-room",
          name: "/admin/cancel-room",
          component: AdminCancelRoom,
        },
      ],
    },
    {
      path: "/dashboard",
      component: AdminLayout,
      children: [
        { path: "/dashboard", name: "/dashboard", component: Dashboard },
      ],
    },
  ],
});

export default router;
