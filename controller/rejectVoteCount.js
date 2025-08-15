// const redisClient = require("../config/redis");

// const managerejectedVoteCtrl = {
//   getRejectedVoteCounts: async (req, res) => {
//     try {
//       const pattern = "RejectedVotes:2025_president:*";
//       let cursor = "0";
//       let keys = [];

//       do {
//         const { cursor: nextCursor, Keys: foundKeys } = await redisClient.scan(
//           cursor,
//           "MATCH",
//           pattern,
//           "COUNT",
//           "100"
//         );
//         cursor = nextCursor;
//         keys = keys.concat(foundKeys);
//       } while (cursor !== "0");

//       const result = {};
//       for (const key of keys) {
//         const count = await redisClient.get(key);
//         result[key.replace("RejectedVotes:2025_president", "")] =
//           parseInt(count);
//       }
//       console.log("🟥 Rejected Votes Breakdown:", result);
//       res.status(200).json(result);
//     } catch (error) {
//       console.error("❌ Failed to fetch rejected votes:", error);
//       res.status(500).json({ message: "Failed to fetch rejected vote counts" });
//     }
//   },
// };

// module.exports = managerejectedVoteCtrl;
const redisClient = require("../config/redis"); //

const managerejectedVoteCtrl = {
  // Controller to get rejected vote counts
  getRejectedVoteCount: async (req, res) => {
    try {
      const electionId = req.query.electionId; // Get electionId from URL query

      // If electionId is not provided, return error
      if (!electionId) {
        return res.status(400).json({ message: "Election ID is required" });
      }

      // Define key pattern for rejected votes (grouped by reason)
      const rejectedKeyPattern = `RejectedVotes:${electionId}:*`;

      // Scan Redis for keys matching the pattern
      const keys = await redisClient.keys(rejectedKeyPattern);

      // Prepare an object to count each rejection reason
      const rejectedCounts = {};

      for (const key of keys) {
        const count = await redisClient.get(key); // Get the count for each key
        const parts = key.split(":"); // Split to get rejection reason
        const reason = parts[2]; // Ex: 'invalid_binary', 'missing_separator', etc.

        rejectedCounts[reason] = parseInt(count) || 0;
      }

      // Return result as JSON
      return res.status(200).json({
        rejectedCounts,
        totalRejected: Object.values(rejectedCounts).reduce((a, b) => a + b, 0),
      });
    } catch (err) {
      console.error("Error fetching rejected votes", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};

module.exports = managerejectedVoteCtrl;
