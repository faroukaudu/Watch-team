const myModule = require("./index.js");
const mongoose = require("mongoose");
const ShiftTemplate = require("./src/models/ShiftTemplate");
const ShiftExchange = require("./src/models/ShiftExchange");
const TimeOffRequest = require("./src/models/TimeOffRequest");

const app = myModule.main;
const User = myModule.userDB;
const Company = mongoose.model("Company");
const { isClientUser, getClientScope } = require("./src/utils/clientScope");

function normalizeArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

// WEB: SHIFT TEMPLATE PAGE
app.get("/shift-template", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const companyId = req.user.assignedCompanyID;
        const Company = mongoose.model("Company");
        const company = await Company.findById(companyId);

        let postSites = company && company.postSite ? company.postSite : [];
        let guardQuery = { assignedCompanyID: companyId, userType: "AmobileGuard" };
        let templateQuery = { companyId: String(companyId) };

        if (isClientUser(req.user)) {
            const { assignedPostSiteId, assignedPostSiteIds } = await getClientScope(req.user);
            postSites = postSites.filter((site) => String(site._id) === assignedPostSiteId);
            guardQuery.guardPostSite = { $elemMatch: { postSiteID: { $in: assignedPostSiteIds } } };
            templateQuery.postSiteId = assignedPostSiteId;
        }

        const guards = await User.find(guardQuery).sort({ fullname: 1 });
        const shiftTemplates = await ShiftTemplate.find(templateQuery).sort({ createdAt: -1 });

        res.render("dashboard/shift-template", {
            userInfo: req.user,
            user: req.user,
            postSites,
            guards,
            shiftTemplates
        });

    } catch (err) {
        console.log("Shift template page error:", err);
        res.redirect("/dashboard");
    }
});

// WEB: CREATE SHIFT TEMPLATE
app.post("/create-shift-template", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const repeatDays = normalizeArray(req.body.repeatDays);
        const breaks = normalizeArray(req.body.breaks);
        const guardsInput = normalizeArray(req.body.guards);

        const [postSiteId, postSiteName] = req.body.postSiteInfo
            ? req.body.postSiteInfo.split("&")
            : ["", ""];

        const guards = guardsInput.map((g) => {
            const [guardId, guardName, guardEmail] = g.split("&");
            return {
                guardId,
                guardName,
                guardEmail
            };
        });

        if (isClientUser(req.user)) {
            const { assignedPostSiteId, allowedGuardIds } = await getClientScope(req.user);
            if (!assignedPostSiteId || String(postSiteId) !== assignedPostSiteId) {
                req.session.accessNotice = "You can create shifts only for your assigned post site.";
                return res.redirect("/shift-template");
            }
            const invalidGuard = guards.some((guard) => !allowedGuardIds.includes(String(guard.guardId)));
            if (invalidGuard) {
                req.session.accessNotice = "You can select only guards assigned to your post site.";
                return res.redirect("/shift-template");
            }
        }

        const shiftTemplate = new ShiftTemplate({
            companyId: String(req.user.assignedCompanyID),

            shiftTitle: req.body.shiftTitle || "",
            startTime: req.body.startTime || "",
            endTime: req.body.endTime || "",

            repeatDays,
            repeatFor: req.body.repeatFor || "",

            postSiteId,
            postSiteName,

            guards,

            breaks,
            note: req.body.note || "",

            createdById: req.user._id,
            createdByName: req.user.fullname,
            createdByUserType: req.user.userType,

            status: "Active"
        });

        await shiftTemplate.save();

        res.redirect("/shift-template");

    } catch (err) {
        console.log("Create shift template error:", err);
        res.redirect("/shift-template");
    }
});



// WEB: UPDATE SHIFT TEMPLATE
app.post("/update-shift-template/:id", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const template = await ShiftTemplate.findOne({
            _id: req.params.id,
            companyId: String(req.user.assignedCompanyID)
        });

        if (!template) {
            req.session.accessNotice = "Shift template not found.";
            return res.redirect("/shift-template");
        }

        const repeatDays = normalizeArray(req.body.repeatDays);
        const breaks = normalizeArray(req.body.breaks);
        const guardsInput = normalizeArray(req.body.guards);
        const [postSiteId, postSiteName] = req.body.postSiteInfo
            ? req.body.postSiteInfo.split("&")
            : ["", ""];

        const guards = guardsInput
            .filter(Boolean)
            .map((g) => {
                const [guardId, guardName, guardEmail] = g.split("&");
                return { guardId, guardName, guardEmail };
            });

        if (isClientUser(req.user)) {
            const { assignedPostSiteId, allowedGuardIds } = await getClientScope(req.user);
            if (!assignedPostSiteId || String(postSiteId) !== assignedPostSiteId) {
                req.session.accessNotice = "You can edit shifts only for your assigned post site.";
                return res.redirect("/shift-template");
            }
            const invalidGuard = guards.some((guard) => !allowedGuardIds.includes(String(guard.guardId)));
            if (invalidGuard) {
                req.session.accessNotice = "You can select only guards assigned to your post site.";
                return res.redirect("/shift-template");
            }
        }

        template.shiftTitle = req.body.shiftTitle || "";
        template.startTime = req.body.startTime || "";
        template.endTime = req.body.endTime || "";
        template.repeatDays = repeatDays;
        template.repeatFor = req.body.repeatFor || "";
        template.postSiteId = postSiteId;
        template.postSiteName = postSiteName;
        template.guards = guards;
        template.breaks = breaks;
        template.note = req.body.note || "";
        template.status = req.body.status === "Inactive" ? "Inactive" : "Active";

        await template.save();
        res.redirect("/shift-template");
    } catch (err) {
        console.log("Update shift template error:", err);
        res.redirect("/shift-template");
    }
});

// WEB: DELETE SHIFT TEMPLATE
app.post("/delete-shift-template/:id", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const template = await ShiftTemplate.findOne({
            _id: req.params.id,
            companyId: String(req.user.assignedCompanyID)
        });

        if (!template) {
            req.session.accessNotice = "Shift template not found.";
            return res.redirect("/shift-template");
        }

        if (isClientUser(req.user)) {
            const { assignedPostSiteId } = await getClientScope(req.user);
            if (String(template.postSiteId) !== assignedPostSiteId) {
                req.session.accessNotice = "You can delete shifts only for your assigned post site.";
                return res.redirect("/shift-template");
            }
        }

        await ShiftTemplate.deleteOne({ _id: template._id });
        res.redirect("/shift-template");
    } catch (err) {
        console.log("Delete shift template error:", err);
        res.redirect("/shift-template");
    }
});

// WEB: GET GUARDS FOR POST SITE
app.get("/api/post-site-guards/:postSiteId", async (req, res) => {
    try {
        const companyId = req.user.assignedCompanyID;
        const postSiteId = req.params.postSiteId;
        if (isClientUser(req.user)) {
            const { assignedPostSiteId, assignedPostSiteIds } = await getClientScope(req.user);
            if (String(postSiteId) !== assignedPostSiteId) {
                return res.status(403).json({ ok: false, message: "You may view guards only for your assigned post site." });
            }
        }

        const guards = await User.find({
            assignedCompanyID: companyId,
            userType: "AmobileGuard",
            guardPostSite: {
                $elemMatch: { postSiteID: postSiteId }
            }
        }).select("fullname email phone userType");

        res.json({
            success: true,
            guards
        });

    } catch (err) {
        console.log("Fetch post site guards error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch guards"
        });
    }
});

// WEB: SHIFT EXCHANGE LIST
app.get("/shift-exchange", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const exchanges = await ShiftExchange.find({
            companyId: String(req.user.assignedCompanyID)
        }).sort({ createdAt: -1 });

        res.render("dashboard/shift-exchange", {
            userInfo: req.user,
            user: req.user,
            exchanges
        });

    } catch (err) {
        console.log("Shift exchange page error:", err);
        res.redirect("/dashboard");
    }
});

// Mobile

function getTodayName() {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

app.get("/api/mobile/open-shifts", async (req, res) => {
    try {
        const { companyId, guardId, postSiteId } = req.query;

        const today = getTodayName();

        const filter = {
            companyId: String(companyId),
            status: "Active",
            repeatDays: today,
            "guards.guardId": String(guardId)
        };

        if (postSiteId) {
            filter.postSiteId = String(postSiteId);
        }

        const shifts = await ShiftTemplate.find(filter).sort({ startTime: 1 });

        res.json({
            success: true,
            today,
            shifts
        });

    } catch (err) {
        console.log("Mobile open shifts error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch open shifts"
        });
    }
});

app.post("/api/mobile/open-shifts/select", async (req, res) => {
    try {
        const { shiftTemplateId, guardId, guardName } = req.body;

        const shift = await ShiftTemplate.findById(shiftTemplateId);

        if (!shift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found"
            });
        }

        const alreadySelected = shift.selectedGuards.some(
            g => String(g.guardId) === String(guardId)
        );

        if (!alreadySelected) {
            shift.selectedGuards.push({
                guardId,
                guardName,
                selectedAt: new Date()
            });
        }

        await shift.save();

        res.json({
            success: true,
            message: "Shift selected successfully",
            shift
        });

    } catch (err) {
        console.log("Select shift error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to select shift"
        });
    }
});

// WEB: ATTENDANCE PAGE
app.get("/attendance", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const companyId = req.user.assignedCompanyID;
        const Company = mongoose.model("Company");

        const company = await Company.findById(companyId).lean();

        const attendance = company && company.checkedReport
            ? company.checkedReport
            : [];

        const postSiteMap = {};

        if (company && company.postSite && company.postSite.length > 0) {
            company.postSite.forEach((site) => {
                const siteId = String(site._id || site.id || "");
                if (siteId) {
                    postSiteMap[siteId] = site.siteName || "Post Site";
                }
            });
        }

        const startDate = req.query.startDate || "";
        const endDate = req.query.endDate || "";

        let filteredAttendance = attendance.map((item) => {
            const siteId = String(item.postSite || item.postSiteId || item.postSiteID || "");

            return {
                ...item,
                postSiteName: item.postSiteName || postSiteMap[siteId] || "Unknown Post Site"
            };
        });

        if (startDate || endDate) {
            filteredAttendance = filteredAttendance.filter((item) => {
                if (!item.checkInTime) return false;

                const checkInDate = new Date(item.checkInTime);

                if (isNaN(checkInDate.getTime())) return false;

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (checkInDate < start) return false;
                }

                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (checkInDate > end) return false;
                }

                return true;
            });
        }

        filteredAttendance = filteredAttendance.sort((a, b) => {
            return new Date(b.checkInTime) - new Date(a.checkInTime);
        });

        res.render("dashboard/attendance", {
            userInfo: req.user,
            user: req.user,
            attendance: filteredAttendance,
            startDate,
            endDate
        });

    } catch (err) {
        console.log("Attendance page error:", err);
        res.redirect("/dashboard");
    }
});


// MOBILE: CREATE SHIFT EXCHANGE REQUEST
// MOBILE: CREATE SHIFT EXCHANGE REQUEST
app.post("/api/mobile/shift-exchange/request", async (req, res) => {
    try {
        const {
            companyId,
            shiftTemplateId,
            shiftTitle,
            postSiteId,
            postSiteName,
            sentByGuardId,
            sentByGuardName,
            receivedByGuardId,
            receivedByGuardName
        } = req.body;

        const existingPending = await ShiftExchange.findOne({
            companyId: String(companyId),
            shiftTemplateId: String(shiftTemplateId),
            receivedByGuardId: String(receivedByGuardId),
            status: "Pending"
        });

        if (existingPending) {
            return res.status(409).json({
                success: false,
                message: "Exchange request already sent"
            });
        }

        const exchange = new ShiftExchange({
            companyId,
            shiftTemplateId,
            shiftTitle,
            postSiteId,
            postSiteName,
            sentByGuardId,
            sentByGuardName,
            receivedByGuardId,
            receivedByGuardName,
            status: "Pending",
            requestDate: new Date()
        });

        await exchange.save();

        res.json({
            success: true,
            message: "Shift exchange request sent",
            exchange
        });

    } catch (err) {
        console.log("Create shift exchange error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to send shift exchange request"
        });
    }
});


// MOBILE: GET RECEIVED SHIFT EXCHANGE REQUESTS
app.get("/api/mobile/shift-exchange/received", async (req, res) => {
    try {
        const { companyId, guardId, shiftTemplateId } = req.query;

        const filter = {
            companyId: String(companyId),
            receivedByGuardId: String(guardId),
            status: "Pending"
        };

        if (shiftTemplateId) {
            filter.shiftTemplateId = String(shiftTemplateId);
        }

        const exchanges = await ShiftExchange.find(filter).sort({ createdAt: -1 });

        res.json({
            success: true,
            exchanges
        });

    } catch (err) {
        console.log("Fetch received shift exchange error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch shift exchange requests"
        });
    }
});


// MOBILE: ACCEPT OR REJECT SHIFT EXCHANGE
app.post("/api/mobile/shift-exchange/respond", async (req, res) => {
    try {
        const { exchangeId, status } = req.body;

        if (!["Accepted", "Rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        const exchange = await ShiftExchange.findById(exchangeId);

        if (!exchange) {
            return res.status(404).json({
                success: false,
                message: "Exchange request not found"
            });
        }

        if (exchange.status !== "Pending") {
            return res.status(409).json({
                success: false,
                message: "Already Assigned"
            });
        }

        if (status === "Accepted") {
            const shift = await ShiftTemplate.findById(exchange.shiftTemplateId);

            if (!shift) {
                return res.status(404).json({
                    success: false,
                    message: "Shift template not found"
                });
            }

            shift.selectedGuards = [
                {
                    guardId: exchange.receivedByGuardId,
                    guardName: exchange.receivedByGuardName,
                    selectedAt: new Date()
                }
            ];

            await shift.save();

            exchange.acceptedByReceiverOnShiftDetail = true;
        }

        exchange.status = status;
        exchange.responseDate = new Date();

        await exchange.save();

        res.json({
            success: true,
            message: `Shift exchange ${status.toLowerCase()}`,
            exchange
        });

    } catch (err) {
        console.log("Respond shift exchange error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to respond to shift exchange"
        });
    }
});

// MOBILE: GET RECEIVED SHIFT EXCHANGE REQUESTS
app.get("/api/mobile/shift-exchange/received", async (req, res) => {
    try {
        const { companyId, guardId } = req.query;

        const exchanges = await ShiftExchange.find({
            companyId: String(companyId),
            receivedByGuardId: String(guardId)
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            exchanges
        });

    } catch (err) {
        console.log("Fetch received shift exchange error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch shift exchange requests"
        });
    }
});

// MOBILE: ACCEPT OR REJECT SHIFT EXCHANGE
// MOBILE: CREATE SHIFT EXCHANGE REQUEST
app.post("/api/mobile/shift-exchange/request", async (req, res) => {
    try {
        const {
            companyId,
            shiftTemplateId,
            shiftTitle,
            postSiteId,
            postSiteName,
            sentByGuardId,
            sentByGuardName,
            receivedByGuardId,
            receivedByGuardName
        } = req.body;

        const exchange = new ShiftExchange({
            companyId,
            shiftTemplateId,
            shiftTitle,
            postSiteId,
            postSiteName,
            sentByGuardId,
            sentByGuardName,
            receivedByGuardId,
            receivedByGuardName,
            status: "Pending",
            requestDate: new Date()
        });

        await exchange.save();

        res.json({
            success: true,
            message: "Shift exchange request sent",
            exchange
        });

    } catch (err) {
        console.log("Create shift exchange error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to send shift exchange request"
        });
    }
});

// MOBILE: GET RECEIVED SHIFT EXCHANGE REQUESTS
app.get("/api/mobile/shift-exchange/received", async (req, res) => {
    try {
        const { companyId, guardId, shiftTemplateId } = req.query;

        const filter = {
            companyId: String(companyId),
            receivedByGuardId: String(guardId),
            status: "Pending"
        };

        if (shiftTemplateId) {
            filter.shiftTemplateId = String(shiftTemplateId);
        }

        const exchanges = await ShiftExchange.find(filter).sort({ createdAt: -1 });

        res.json({
            success: true,
            exchanges
        });

    } catch (err) {
        console.log("Fetch received shift exchange error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch shift exchange requests"
        });
    }
});

// MOBILE: ACCEPT OR REJECT SHIFT EXCHANGE
app.post("/api/mobile/shift-exchange/respond", async (req, res) => {
    try {
        const { exchangeId, status } = req.body;

        if (!["Accepted", "Rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        const exchange = await ShiftExchange.findById(exchangeId);

        if (!exchange) {

            if (exchange.status !== "Pending") {
                return res.status(409).json({
                    success: false,
                    message: "Already Assigned"
                });
            }
            return res.status(404).json({
                success: false,
                message: "Exchange request not found"
            });
        }

        exchange.status = status;
        exchange.responseDate = new Date();

        if (status === "Accepted") {
            exchange.acceptedByReceiverOnShiftDetail = true;
        }

        await exchange.save();

        if (status === "Accepted") {
            const shift = await ShiftTemplate.findById(exchange.shiftTemplateId);

            if (shift) {
                shift.selectedGuards = [
                    {
                        guardId: exchange.receivedByGuardId,
                        guardName: exchange.receivedByGuardName,
                        selectedAt: new Date()
                    }
                ];

                if (shift.selectedGuards && shift.selectedGuards.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: "Already Assigned"
                    });
                }

                await shift.save();
            }
        }

        res.json({
            success: true,
            message: `Shift exchange ${status.toLowerCase()}`,
            exchange
        });

    } catch (err) {
        console.log("Respond shift exchange error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to respond to shift exchange"
        });
    }
});

// MOBILE: GET GUARDS ON SHIFT POST SITE, EXCLUDING CURRENT GUARD
app.get("/api/mobile/shift-exchange/guards", async (req, res) => {
    try {
        const { companyId, postSiteId, guardId } = req.query;

        const guards = await User.find({
            assignedCompanyID: companyId,
            userType: "AmobileGuard",
            _id: { $ne: guardId },
            guardPostSite: {
                $elemMatch: { postSiteID: postSiteId }
            }
        }).select("fullname email phone userType");

        res.json({
            success: true,
            guards
        });

    } catch (err) {
        console.log("Fetch exchange guards error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch guards"
        });
    }
});




// MOBILE: CREATE TIME OFF REQUEST
app.post("/api/mobile/time-off/request", async (req, res) => {
    try {
        const {
            companyId,
            guardId,
            guardName,
            guardEmail,
            fromDate,
            toDate
        } = req.body;

        const existingPending = await TimeOffRequest.findOne({
            companyId: String(companyId),
            guardId: String(guardId),
            status: "Pending"
        });

        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: "You already have a pending time off request"
            });
        }

        const request = new TimeOffRequest({
            companyId,
            guardId,
            guardName,
            guardEmail,
            fromDate: String(fromDate),
            toDate: String(toDate),
            status: "Pending",
            requestDate: new Date()
        });

        await request.save();

        res.json({
            success: true,
            message: "Time off request submitted",
            request
        });

    } catch (err) {
        console.log("Create time off error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to submit time off request"
        });
    }
});

// MOBILE: GET MY TIME OFF REQUESTS
app.get("/api/mobile/time-off/my-requests", async (req, res) => {
    try {
        const { companyId, guardId } = req.query;

        const requests = await TimeOffRequest.find({
            companyId: String(companyId),
            guardId: String(guardId)
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            requests
        });

    } catch (err) {
        console.log("Fetch my time off error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch time off requests"
        });
    }
});

// WEB: TIME OFF PAGE
app.get("/time-off", async (req, res) => {
    // console.log("I AM HERE!!!!!!!", companyId);
    try {
        if (!req.user) return res.redirect("/sign-in");

        const companyId = String(req.user.assignedCompanyID);
        console.log("I AM HERE!!!!!!!", companyId);


        const requests = await TimeOffRequest.find({
            companyId: companyId
        })
            .sort({ createdAt: -1 })
            .lean();

        console.log("WEB TIME OFF COMPANY ID:", companyId);
        console.log("WEB TIME OFF COUNT:", requests.length);
        console.log("WEB TIME OFF SAMPLE:", requests[0]);

        res.render("dashboard/time-off", {
            userInfo: req.user,
            user: req.user,
            requests: requests || []
        });

    } catch (err) {
        console.log("Time off page error:", err);
        res.redirect("/dashboard");
    }
});



// WEB: ACCEPT / REJECT TIME OFF
app.post("/time-off/respond", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const { requestId, status } = req.body;

        if (!["Accepted", "Rejected"].includes(status)) {
            return res.redirect("/time-off");
        }

        await TimeOffRequest.findByIdAndUpdate(requestId, {
            status,
            reviewedById: req.user._id,
            reviewedByName: req.user.fullname,
            reviewedAt: new Date()
        });

        res.redirect("/time-off");

    } catch (err) {
        console.log("Time off respond error:", err);
        res.redirect("/time-off");
    }
});


// MOBILE: MY SCHEDULE
app.get("/api/mobile/my-schedule", async (req, res) => {
    try {
        const { companyId, guardId } = req.query;

        const shifts = await ShiftTemplate.find({
            companyId: String(companyId),
            status: "Active",
            $or: [
                { "guards.guardId": String(guardId) },
                { "selectedGuards.guardId": String(guardId) }
            ]
        }).sort({ startTime: 1 });

        res.json({
            success: true,
            shifts
        });

    } catch (err) {
        console.log("My schedule error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch schedule"
        });
    }
});



// MOBILE/WEB: NOTIFICATIONS FROM COMPANY ACTIVITY
app.get("/api/notifications", async (req, res) => {
    try {
        const companyId = req.query.companyId || (req.user && req.user.assignedCompanyID);
        const viewerId = String(req.query.viewerId || (req.user && req.user._id) || "");
        if (!companyId) return res.json({ success: false, notifications: [], unread: 0 });

        const company = await Company.findById(companyId);
        const notifications = ((company && company.activity) || []).slice(-50).reverse();
        const unread = notifications.filter(n => !(n.readBy || []).map(String).includes(viewerId)).length;
        res.json({ success: true, notifications, unread });
    } catch (err) {
        console.log("Notifications error:", err);
        res.status(500).json({ success: false, notifications: [], unread: 0 });
    }
});

app.post("/api/notifications/clear", async (req, res) => {
    try {
        const companyId = req.body.companyId || (req.user && req.user.assignedCompanyID);
        const viewerId = String(req.body.viewerId || (req.user && req.user._id) || "");
        if (!companyId || !viewerId) return res.json({ success: false });

        const company = await Company.findById(companyId);
        if (company && company.activity) {
            company.activity.forEach(a => {
                a.readBy = a.readBy || [];
                if (!a.readBy.map(String).includes(viewerId)) a.readBy.push(viewerId);
            });
            await company.save();
        }
        res.json({ success: true });
    } catch (err) {
        console.log("Clear notifications error:", err);
        res.status(500).json({ success: false });
    }
});


// WEB: DELETE ATTENDANCE RECORD
app.post("/attendance/:attendanceId/delete", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const companyId = String(req.user.assignedCompanyID || "");
        const Company = mongoose.model("Company");
        const result = await Company.updateOne(
            { _id: companyId },
            { $pull: { checkedReport: { _id: req.params.attendanceId } } }
        );

        if (!result.modifiedCount) {
            return res.redirect("/attendance?error=Attendance+record+not+found");
        }

        return res.redirect("/attendance?success=Attendance+record+deleted");
    } catch (err) {
        console.log("Delete attendance error:", err);
        return res.redirect("/attendance?error=Unable+to+delete+attendance+record");
    }
});

// WEB: DELETE SHIFT EXCHANGE
app.post("/shift-exchange/:id/delete", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const companyId = String(req.user.assignedCompanyID || "");
        const deleted = await ShiftExchange.findOneAndDelete({
            _id: req.params.id,
            companyId
        });

        if (!deleted) {
            return res.redirect("/shift-exchange?error=Exchange+request+not+found");
        }

        return res.redirect("/shift-exchange?success=Exchange+request+deleted");
    } catch (err) {
        console.log("Delete shift exchange error:", err);
        return res.redirect("/shift-exchange?error=Unable+to+delete+exchange+request");
    }
});

// WEB: DELETE TIME OFF REQUEST
app.post("/time-off/:id/delete", async (req, res) => {
    try {
        if (!req.user) return res.redirect("/sign-in");

        const companyId = String(req.user.assignedCompanyID || "");
        const deleted = await TimeOffRequest.findOneAndDelete({
            _id: req.params.id,
            companyId
        });

        if (!deleted) {
            return res.redirect("/time-off?error=Time+off+request+not+found");
        }

        return res.redirect("/time-off?success=Time+off+request+deleted");
    } catch (err) {
        console.log("Delete time off error:", err);
        return res.redirect("/time-off?error=Unable+to+delete+time+off+request");
    }
});
