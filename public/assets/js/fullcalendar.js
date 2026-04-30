(function () {
  "use strict";

  // ===== Activity list helpers (Recent 7) =====
  const activityListEl = document.getElementById("activity-list");

  function buildBadge(ev) {
    const now = moment();
    const start = moment(ev.start);
    const end = ev.end ? moment(ev.end) : null;

    if (start.isBefore(now, "minute")) return { text: "Completed", cls: "badge bg-success mb-1" };
    if (start.isSame(now, "day")) return { text: "Today", cls: "badge bg-warning-transparent mb-1" };
    if (start.diff(now, "days") <= 3) return { text: "Due Soon", cls: "badge bg-danger-transparent mb-1" };

    if (ev.allDay) return { text: "All day", cls: "badge bg-light text-default mb-1" };

    const timeText = end
      ? `${start.format("hh:mma")} - ${end.format("hh:mma")}`
      : start.format("hh:mma");

    return { text: timeText, cls: "badge bg-light text-default mb-1" };
  }

  function renderActivityList(events) {
    if (!activityListEl) return;

    // wipe the hardcoded LI you currently have
    activityListEl.innerHTML = "";

    if (!events || !events.length) {
      activityListEl.innerHTML = `<li><p class="mb-0 text-muted fs-12">No tasks yet.</p></li>`;
      return;
    }

    // Most recent 7 (by start date descending)
    const sorted = [...events]
      .filter(e => e.start) // safety
      .sort((a, b) => b.start - a.start)
      .slice(0, 7);

    sorted.forEach((ev) => {
      const start = moment(ev.start);
      const dateText = start.format("dddd, MMM D, YYYY");
      const badge = buildBadge(ev);

      const desc =
        (ev.extendedProps && (ev.extendedProps.description || ev.extendedProps.frequency)) || "";

      const descText = desc ? `${ev.title} — ${desc}` : ev.title;

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="d-flex align-items-center justify-content-between flex-wrap">
          <p class="mb-1 fw-medium">${dateText}</p>
          <span class="${badge.cls}">${badge.text}</span>
        </div>
        <p class="mb-0 text-muted fs-12">${descText}</p>
      `;
      activityListEl.appendChild(li);
    });
  }

  // ===== Calendar main =====
  const ctx = window.CALENDAR_CONTEXT || {};
  const companyId = ctx.companyId;
  const userId = ctx.userId;

  const calendarEl = document.getElementById("calendar2");
  const modalEl = document.getElementById("add-task");
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  // Inputs (match your EJS)
  const titleEl = document.getElementById("title");
  const assignToEl = document.getElementById("taskTags"); // single select (guardId)
  const postSiteEl = document.getElementById("choices-multiple-remove-button1");
  const freqEl = document.getElementById("taskFrequency");
  const targetDateEl = document.getElementById("targetDate");
  // const targetDateEl = document.getElementsByClassName("targetDate");
  const descEl = document.getElementById("taskEmail"); // your label says Description, id is taskEmail
  const submitBtn = document.getElementById("submitTaskBtn");

  // pending drop/select state
  let pending = {
    tempEvent: null,
    revertFn: null,
    start: null,
    end: null,
    allDay: false,
    className: "bg-primary-transparent",
    titleFromDrag: ""
  };

  // flatpickr init (optional)
  if (window.flatpickr && targetDateEl) {
    flatpickr(targetDateEl, { enableTime: true, dateFormat: "Y-m-d H:i" });
  }

  function resetForm() {
    if (titleEl) titleEl.value = "";
    if (descEl) descEl.value = "";
    if (freqEl) freqEl.value = "";
    if (targetDateEl) targetDateEl.value = "";

    // reset selects to placeholder (first option)
    if (assignToEl) assignToEl.selectedIndex = 0;
    if (postSiteEl) postSiteEl.selectedIndex = 0;
  }

  function openTaskModal({ start, end, allDay, className, titleHint, tempEvent, revertFn }) {
    resetForm();

    pending.tempEvent = tempEvent || null;
    pending.revertFn = revertFn || null;
    pending.start = start;
    pending.end = end;
    pending.allDay = !!allDay;
    pending.className = className || "bg-primary-transparent";
    pending.titleFromDrag = titleHint || "";

    // Prefill title/date
    if (titleEl) titleEl.value = titleHint || "";
    if (targetDateEl) {
      targetDateEl.value = allDay
        ? moment(start).format("YYYY-MM-DD")
        : moment(start).format("YYYY-MM-DD HH:mm");
    }

    if (modal) modal.show();
  }

  // if modal closes without saving => revert temp event
  if (modalEl) {
    modalEl.addEventListener("hidden.bs.modal", () => {
      if (pending.tempEvent) pending.tempEvent.remove();
      if (pending.revertFn) {
        try { pending.revertFn(); } catch (_) {}
      }
      pending = { tempEvent: null, revertFn: null, start: null, end: null, allDay: false, className: "bg-primary-transparent", titleFromDrag: "" };
    });
  }

  // submit saves to DB
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      try {
        const title = (titleEl?.value || pending.titleFromDrag || "Task").trim();
        const assignedTo = assignToEl?.value || "";           // ✅ single string
        const postSiteId = postSiteEl?.value || "";           // ✅ single string
        const frequency = (freqEl?.value || "").trim();
        const description = (descEl?.value || "").trim();

        // start date
        let start = pending.start;
        if (targetDateEl?.value) {
          const m = moment(targetDateEl.value, ["YYYY-MM-DD HH:mm", "YYYY-MM-DD"], true);
          if (m.isValid()) start = m.toDate();
        }

        const payload = {
          companyId,
          userId,
          title,
          start,
          end: pending.end,
          allDay: pending.allDay,
          className: pending.className,

          // single fields
          assignedTo,     // ✅ STRING (guard id)
          postSiteId,     // ✅ STRING (postSite id)
          frequency,      // ✅ STRING
          description     // ✅ STRING
        };

        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          alert("Failed to save task: " + msg);
          return;
        }

        // success: remove temp event, close modal, refetch
        if (pending.tempEvent) pending.tempEvent.remove();
        pending.revertFn = null; // stop revert-on-close
        if (modal) modal.hide();

        calendar.refetchEvents();
      } catch (e) {
        console.error(e);
        alert("Something went wrong saving task");
      }
    });
  }

  // external draggable
  const containerEl = document.getElementById("external-events");
  if (containerEl && window.FullCalendar?.Draggable) {
    new FullCalendar.Draggable(containerEl, {
      itemSelector: ".fc-event",
      eventData: function (eventEl) {
        return {
          title: eventEl.innerText.trim(),
          className: eventEl.className
        };
      }
    });
  }

  // Create calendar
  const calendar = new FullCalendar.Calendar(calendarEl, {
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
    },
    initialView: "dayGridMonth",
    editable: true,
    selectable: true,
    droppable: true,
    dayMaxEvents: true,

    // Pull events from DB
    events: async (info, success, fail) => {
      try {
        const r = await fetch(`/api/events?companyId=${companyId}&userId=${userId}`);
        const data = await r.json();
        success(data);
      } catch (e) {
        fail(e);
      }
    },

    // Activity updates whenever calendar data changes
    eventsSet: function (events) {
      renderActivityList(events);
    },

    // drag external item -> modal before saving
    eventReceive: function (info) {
      openTaskModal({
        start: info.event.start,
        end: info.event.end,
        allDay: info.event.allDay,
        className: info.event.classNames?.join(" ") || "bg-primary-transparent",
        titleHint: info.event.title,
        tempEvent: info.event,
        revertFn: info.revert
      });
    },

    // select date/range -> modal before saving
    select: function (arg) {
      openTaskModal({
        start: arg.start,
        end: arg.end,
        allDay: arg.allDay,
        className: "bg-primary-transparent",
        titleHint: "",
        tempEvent: null,
        revertFn: () => calendar.unselect()
      });
    },

    // delete existing event
    eventClick: async function (arg) {
      if (!confirm("Delete this task?")) return;

      const res = await fetch(`/api/events/${arg.event.id}`, { method: "DELETE" });
      if (res.ok) arg.event.remove();
      else alert("Failed to delete");
    },

    // drag existing DB event -> update DB
    eventDrop: async function (info) {
      await fetch(`/api/events/${info.event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: info.event.start,
          end: info.event.end,
          allDay: info.event.allDay
        })
      });
    },

    eventResize: async function (info) {
      await fetch(`/api/events/${info.event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: info.event.start,
          end: info.event.end
        })
      });
    }
  });

  calendar.render();
})();
