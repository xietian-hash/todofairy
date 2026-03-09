const api = require("../../services/api");
const { getToken, setToken } = require("../../services/http");
const { getTodayDate, monthOfDate, shiftMonth, listMonthGrid } = require("../../utils/date");

const TASK_MODAL_ANIM_DURATION = 160;
const TASK_MODAL_CLOSE_DELAY = TASK_MODAL_ANIM_DURATION + 20;

function defaultTaskForm(today) {
  return {
    title: "",
    remark: "",
    effectiveStartDate: today,
    effectiveEndDate: "",
  };
}

Page({
  data: {
    ready: false,
    loading: false,
    errorText: "",
    today: "",
    currentMonth: "",
    selectedDate: "",
    calendarCells: [],
    dayStatusMap: {},
    todos: [],
    completedCount: 0,
    uncompletedCount: 0,
    total: 0,
    progressPercent: 0,
    taskModalVisible: false,
    taskModalMode: "create",
    editingTaskId: "",
    taskForm: {},
    taskModalSaving: false,
    taskModalClosing: false,
    taskModalAnimation: null,
    statusBarHeight: 0,
    navBarHeight: 44,
  },

  async onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const menuBtn = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sysInfo.statusBarHeight;
    const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    const today = getTodayDate();
    this.setData({
      statusBarHeight,
      navBarHeight,
      today,
      selectedDate: today,
      currentMonth: monthOfDate(today),
      taskForm: defaultTaskForm(today),
    });
    await this.bootstrap();
  },

  onUnload() {
    if (this._taskModalCloseTimer) {
      clearTimeout(this._taskModalCloseTimer);
      this._taskModalCloseTimer = null;
    }
  },

  async onPullDownRefresh() {
    await this.loadPageData();
    wx.stopPullDownRefresh();
  },

  async bootstrap() {
    this.setData({ loading: true, errorText: "" });
    try {
      await this.ensureLogin();
      await this.loadPageData();
      this.setData({ ready: true });
    } catch (err) {
      this.setData({
        errorText: err.message || "初始化失败，请重试",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async ensureLogin() {
    if (getToken()) {
      return;
    }
    const loginData = await api.login();
    setToken(loginData.token);
    getApp().globalData.token = loginData.token;
  },

  async loadPageData() {
    this.setData({ loading: true, errorText: "" });
    try {
      await this.loadCalendar();
      await this.loadTodos();
    } catch (err) {
      this.setData({
        errorText: err.message || "加载失败",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadCalendar() {
    const { currentMonth, selectedDate, today } = this.data;
    const data = await api.getMonthCalendar(currentMonth);
    const dayStatusMap = {};
    (data.days || []).forEach((day) => {
      dayStatusMap[day.date] = day.status;
    });
    const cells = listMonthGrid(currentMonth, selectedDate, today, dayStatusMap);
    this.setData({
      dayStatusMap,
      calendarCells: cells,
    });
  },

  async loadTodos() {
    const { selectedDate } = this.data;
    const data = await api.getTodos(selectedDate);
    const completed = data.completedCount || 0;
    const total = data.total || 0;
    this.setData({
      todos: data.list || [],
      completedCount: completed,
      uncompletedCount: data.uncompletedCount || 0,
      total,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  },

  async onMonthShift(e) {
    const delta = Number(e.currentTarget.dataset.delta || 0);
    const nextMonth = shiftMonth(this.data.currentMonth, delta);
    this.setData({
      currentMonth: nextMonth,
    });
    await this.loadCalendar();
  },

  async onSelectDate(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    this.setData({
      selectedDate: date,
    });
    await this.loadCalendar();
    await this.loadTodos();
  },

  async onToggleTodoStatus(e) {
    const { todoId, status } = e.currentTarget.dataset;
    if (!todoId) return;
    const currentStatus = Number(status || 1);
    const nextStatus = currentStatus === 2 ? 1 : 2;
    try {
      await api.updateTodoStatus(todoId, nextStatus);
      await this.loadTodos();
      await this.loadCalendar();
    } catch (err) {
      wx.showToast({
        title: err.message || "操作失败",
        icon: "none",
      });
    }
  },

  onOpenCreateTask() {
    const { today } = this.data;
    if (this._taskModalCloseTimer) {
      clearTimeout(this._taskModalCloseTimer);
      this._taskModalCloseTimer = null;
    }
    const initialAnimation = wx.createAnimation({
      duration: 0,
      timingFunction: "linear",
    });
    initialAnimation.translateY("100%").step();
    this.setData({
      taskModalVisible: true,
      taskModalClosing: false,
      taskModalMode: "create",
      editingTaskId: "",
      taskForm: defaultTaskForm(today),
      taskModalAnimation: initialAnimation.export(),
    });

    wx.nextTick(() => {
      const openAnimation = wx.createAnimation({
        duration: TASK_MODAL_ANIM_DURATION,
        timingFunction: "ease-out",
      });
      openAnimation.translateY("0").step();
      this.setData({
        taskModalAnimation: openAnimation.export(),
      });
    });
  },

  onCloseTaskModal() {
    if (!this.data.taskModalVisible || this.data.taskModalClosing) {
      return;
    }
    const closeAnimation = wx.createAnimation({
      duration: TASK_MODAL_ANIM_DURATION,
      timingFunction: "ease-in",
    });
    closeAnimation.translateY("100%").step();
    this.setData({
      taskModalClosing: true,
      taskModalAnimation: closeAnimation.export(),
    });
    if (this._taskModalCloseTimer) {
      clearTimeout(this._taskModalCloseTimer);
    }
    this._taskModalCloseTimer = setTimeout(() => {
      this._taskModalCloseTimer = null;
      this.setData({
        taskModalVisible: false,
        taskModalClosing: false,
        taskModalAnimation: null,
        taskModalSaving: false,
      });
    }, TASK_MODAL_CLOSE_DELAY);
  },

  onMaskTap() {
    this.onCloseTaskModal();
  },

  onMaskTouchMove() {
    // 拦截背景滚动，避免弹窗打开时穿透到底层页面。
  },

  onPanelTap() {
    // 拦截冒泡，避免点击弹窗内容时触发遮罩关闭。
  },

  onTaskTitleInput(e) {
    this.setData({
      "taskForm.title": e.detail.value,
    });
  },

  onTaskRemarkInput(e) {
    this.setData({
      "taskForm.remark": e.detail.value,
    });
  },

  onTaskStartDateChange(e) {
    this.setData({
      "taskForm.effectiveStartDate": e.detail.value,
    });
  },

  onTaskEndDateChange(e) {
    this.setData({
      "taskForm.effectiveEndDate": e.detail.value,
    });
  },

  async onSaveTask() {
    const { taskForm, taskModalMode, editingTaskId } = this.data;
    if (!taskForm.title || !taskForm.title.trim()) {
      wx.showToast({
        title: "请输入任务标题",
        icon: "none",
      });
      return;
    }
    if (!taskForm.effectiveStartDate) {
      wx.showToast({
        title: "请选择开始日期",
        icon: "none",
      });
      return;
    }

    const payload = {
      title: taskForm.title.trim(),
      remark: (taskForm.remark || "").trim(),
      effectiveStartDate: taskForm.effectiveStartDate,
      effectiveEndDate: taskForm.effectiveEndDate || null,
      repeatRule: { type: "daily" },
      status: 1,
    };

    this.setData({
      taskModalSaving: true,
    });

    try {
      if (taskModalMode === "create") {
        await api.createTask(payload);
      } else {
        await api.updateTask(editingTaskId, payload);
      }
      wx.showToast({
        title: "保存成功",
        icon: "success",
      });
      this.onCloseTaskModal();
      await this.loadPageData();
    } catch (err) {
      wx.showToast({
        title: err.message || "保存失败",
        icon: "none",
      });
    } finally {
      this.setData({
        taskModalSaving: false,
      });
    }
  },
});
