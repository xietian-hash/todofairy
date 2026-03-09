const api = require("../../services/api");
const { getToken, setToken } = require("../../services/http");
const { getTodayDate, monthOfDate, shiftMonth, listMonthGrid } = require("../../utils/date");

function defaultTaskForm(today) {
  return {
    title: "",
    remark: "",
    effectiveStartDate: today,
    effectiveEndDate: today,
    longTerm: false,
    status: 1,
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
    taskModalVisible: false,
    taskModalMode: "create",
    editingTaskId: "",
    taskForm: {},
    taskModalSaving: false,
  },

  async onLoad() {
    const today = getTodayDate();
    this.setData({
      today,
      selectedDate: today,
      currentMonth: monthOfDate(today),
      taskForm: defaultTaskForm(today),
    });
    await this.bootstrap();
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
    this.setData({
      todos: data.list || [],
      completedCount: data.completedCount || 0,
      uncompletedCount: data.uncompletedCount || 0,
      total: data.total || 0,
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
    this.setData({
      taskModalVisible: true,
      taskModalMode: "create",
      editingTaskId: "",
      taskForm: defaultTaskForm(today),
    });
  },

  onCloseTaskModal() {
    this.setData({
      taskModalVisible: false,
      taskModalSaving: false,
    });
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

  onTaskLongTermSwitch(e) {
    this.setData({
      "taskForm.longTerm": e.detail.value,
    });
  },

  onTaskStatusChange(e) {
    this.setData({
      "taskForm.status": Number(e.detail.value),
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
      effectiveEndDate: taskForm.longTerm ? null : taskForm.effectiveEndDate || null,
      repeatRule: { type: "daily" },
      status: Number(taskForm.status || 1),
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
