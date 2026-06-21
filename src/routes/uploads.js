// const cloudinary = require("../cloudinary");

// module.exports = function registerUploadRoutes(app) {
//   // POST /uploads/cloudinary-sign
//   app.post("/uploads/cloudinary-sign", (req, res) => {
//     try {
//       const { reportId, kind } = req.body;
//       if (!reportId || !kind) {
//         return res.status(400).json({ error: "reportId and kind are required" });
//       }

//       const resourceType = (kind === "video" || kind === "audio") ? "video" : "image";
//       const folder = `watch-team/reports/${reportId}/${kind}`;
//       const timestamp = Math.floor(Date.now() / 1000);

//       const signature = cloudinary.utils.api_sign_request(
//         { timestamp, folder },
//         process.env.CLOUDINARY_API_SECRET
//       );

//       return res.json({
//         cloudName: process.env.CLOUDINARY_CLOUD_NAME,
//         apiKey: process.env.CLOUDINARY_API_KEY,
//         timestamp,
//         signature,
//         folder,
//         resourceType,
//       });
//     } catch (err) {
//       console.error("Cloudinary sign error:", err);
//       return res.status(500).json({ error: "Server error signing upload" });
//     }
//   });
// };

const cloudinary = require("../cloudinary");

module.exports = function registerUploadRoutes(app) {
  app.post("/uploads/cloudinary-sign", (req, res) => {
  try {
    const { reportId, dispatchId, visitorTempId, kind, moduleType } = req.body;

    if (!kind) {
      return res.status(400).json({ error: "kind is required" });
    }

    let folder = "";

    if (moduleType === "dispatch") {
      if (!dispatchId) {
        return res.status(400).json({ error: "dispatchId is required" });
      }

      folder = `watch-team/dispatch/${dispatchId}/${kind}`;

    } else if (moduleType === "visitor") {
      if (!visitorTempId) {
        return res.status(400).json({ error: "visitorTempId is required" });
      }

      folder = `watch-team/visitors/${visitorTempId}/${kind}`;

    } else if (moduleType === "watchmode") {
  const { watchModeTempId } = req.body;

  if (!watchModeTempId) {
    return res.status(400).json({ error: "watchModeTempId is required" });
  }
folder = `watch-team/watchmode/${watchModeTempId}/${kind}`;
    
}else {
      if (!reportId) {
        return res.status(400).json({ error: "reportId is required" });
      }

      folder = `watch-team/reports/${reportId}/${kind}`;
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder,
      resourceType: "auto"
    });

  } catch (err) {
    console.error("Cloudinary sign error:", err);
    res.status(500).json({ error: "Server error signing upload" });
  }
});
};