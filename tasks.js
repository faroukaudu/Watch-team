const PostSiteTask = require("./src/models/PostSiteTask");
const myModule = require("./index.js");
const mongoose = require("mongoose");
const ShiftTemplate = require("./src/models/ShiftTemplate");
const ShiftExchange = require("./src/models/ShiftExchange");
const TimeOffRequest = require("./src/models/TimeOffRequest");

const app = myModule.main;
const User = myModule.userDB;


function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// WEB: CREATE POST SITE TASK
app.post("/create-post-site-task", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/sign-in");

    const {
      postSiteId,
      postSiteName,
      taskName,
      taskDescription,
      maxDuration,
      taskType,
      oneOffStartDateTime,
      oneOffDueDateTime,
      recurringContinuous,
      recurringMode,
      recurringStartTime,
      recurringStartingFrom,
      repeatType,
      repeatEvery,
      repeatEndType,
      repeatEndAfter
    } = req.body;

    const guardsInput = normalizeArray(req.body.assignedGuards);
    const scheduledDays = normalizeArray(req.body.scheduledDays);
    const subTaskInput = normalizeArray(req.body.subTasks);

    const assignedGuards = guardsInput.map((g) => {
      const [guardId, guardName, guardEmail] = g.split("&");
      return { guardId, guardName, guardEmail };
    });

    const task = new PostSiteTask({
      companyId: String(req.user.assignedCompanyID),

      postSiteId: String(postSiteId),
      postSiteName,

      taskName,
      taskDescription,
      maxDuration,

      assignedGuards,

      taskType,

      oneOff: {
        startDateTime: taskType === "One-Off" ? new Date(oneOffStartDateTime) : null,
        dueDateTime: taskType === "One-Off" ? new Date(oneOffDueDateTime) : null
      },

      recurring: {
        continuous: recurringContinuous === "on",
        scheduledDays,
        mode: recurringMode || "Specific Time",
        startTime: recurringStartTime || "",
        startingFrom: recurringStartingFrom ? new Date(recurringStartingFrom) : null,
        repeatType: repeatType || "",
        repeatEvery: repeatEvery ? Number(repeatEvery) : 1,
        repeatEndType: repeatEndType || "",
        repeatEndAfter: repeatEndAfter ? Number(repeatEndAfter) : 0
      },

      subTasks: subTaskInput
        .filter(item => item && item.trim() !== "")
        .map(item => ({ title: item.trim() })),

      createdById: req.user._id,
      createdByName: req.user.fullname,
      status: "Active"
    });

    await task.save();

    res.redirect("back");

  } catch (err) {
    console.log("Create post site task error:", err);
    res.redirect("back");
  }
});

// WEB: DELETE POST SITE TASK
app.post("/delete-post-site-task/:id", async (req, res) => {
  try {
    if (!req.user) return res.redirect("/sign-in");

    await PostSiteTask.findByIdAndDelete(req.params.id);

    res.redirect("back");
  } catch (err) {
    console.log("Delete task error:", err);
    res.redirect("back");
  }
});

// MOBILE + WEB API: TASK LIST
// MOBILE + WEB API: TASK LIST
app.get("/api/post-site-tasks", async (req, res) => {
  try {
    const { companyId, postSiteId, guardId, date } = req.query;

    const filter = {
      companyId: String(companyId),
      status: "Active"
    };

    if (postSiteId) filter.postSiteId = String(postSiteId);

    if (guardId) {
      filter["assignedGuards.guardId"] = String(guardId);
    }

    let tasks = await PostSiteTask.find(filter).sort({ createdAt: -1 }).lean();

    if (date) {
      const [year, month, day] = String(date).split("-").map(Number);

      const targetDate = new Date(year, month - 1, day);
      targetDate.setHours(0, 0, 0, 0);

      const targetEnd = new Date(year, month - 1, day);
      targetEnd.setHours(23, 59, 59, 999);

      const dayName = targetDate.toLocaleDateString("en-US", {
        weekday: "long"
      });

      // ✅ Do NOT use toISOString here
      const dateOnly = String(date).split("T")[0];

      tasks = tasks.filter((task) => {
        if (task.taskType === "One-Off") {
          const due = task.oneOff && task.oneOff.dueDateTime
            ? new Date(task.oneOff.dueDateTime)
            : null;

          const start = task.oneOff && task.oneOff.startDateTime
            ? new Date(task.oneOff.startDateTime)
            : null;

          if (!start || !due) return false;

          // ✅ checks if selected day overlaps task window
          return start <= targetEnd && due >= targetDate;
        }

        if (task.taskType === "Recurring") {
          const completedToday = task.completions && task.completions.some(c =>
            String(c.guardId) === String(guardId) &&
            c.completedDate === dateOnly &&
            c.status === "Completed"
          );

          if (completedToday) return false;

          if (task.recurring && task.recurring.continuous) {
            return task.recurring.scheduledDays &&
              task.recurring.scheduledDays.includes(dayName);
          }

          if (
            task.recurring &&
            task.recurring.scheduledDays &&
            task.recurring.scheduledDays.length > 0
          ) {
            return task.recurring.scheduledDays.includes(dayName);
          }

          if (task.recurring && task.recurring.startingFrom) {
            const startingFrom = new Date(task.recurring.startingFrom);
            startingFrom.setHours(0, 0, 0, 0);

            return targetDate >= startingFrom;
          }

          return true;
        }

        return true;
      });
    }

    res.json({
      success: true,
      tasks
    });

  } catch (err) {
    console.log("Fetch post site tasks error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks"
    });
  }
});

app.post("/api/post-site-tasks/:id/complete", async (req, res) => {
  try {
    const { guardId, completedDate, completedSubTasks } = req.body;

    const task = await PostSiteTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    const dateOnly = completedDate || new Date().toISOString().split("T")[0];

    const alreadyCompleted = task.completions.find(
      c => String(c.guardId) === String(guardId) && c.completedDate === dateOnly
    );

    if (alreadyCompleted) {
      alreadyCompleted.completedSubTasks = completedSubTasks || [];
      alreadyCompleted.status = "Completed";
      alreadyCompleted.completedAt = new Date();
    } else {
      task.completions.push({
        guardId,
        completedDate: dateOnly,
        completedAt: new Date(),
        completedSubTasks: completedSubTasks || [],
        status: "Completed"
      });
    }

    if (task.taskType === "One-Off") {
      task.status = "Completed";
    }

    await task.save();

    res.json({
      success: true,
      message: "Task completed successfully",
      task
    });

  } catch (err) {
    console.log("Complete task error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to complete task"
    });
  }
});