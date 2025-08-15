const router = require("../routes");
const redisClient = require("../config/redis");
const addCandidateTable = require("../models/addCandidatesModel");

const manageShowVoteCtrl = {
  getshowvot: async (req, res) => {
    const { decrypted_vote } = req.body;

    console.log("\n🔵 ================================");
    console.log(`📥 Incoming decrypted vote: ${decrypted_vote}`);
    console.log("🔵 ================================");

    // ✅ Initial format check
    if (!decrypted_vote.includes(":")) {
      await redisClient.incr("RejectedVotes:2025_president:missing_separator");
      return res
        .status(400)
        .json({ message: "🚫 Missing ':' separator — vote rejected" });
    }

    const part = decrypted_vote.split(":");
    const voterRandomBits = part[0]; // Unique 16-bit random code per vote
    const candidateName = part[1]; // Candidate's name (ex: Kasun_Sabasignha)
    //const candidateNumber = part[2]; // Candidate's number (ex: 01)

    // ✅ Basic validation: must have all parts
    if (!voterRandomBits || !candidateName) {
      await redisClient.incr("RejectedVotes:2025_president:missing_fields");
      console.log("🚫 Invalid Vote Format — missing fields");
      return res.status(400).json({ message: "🚫 Invalid Vote Format" });
    }

    // Check if binary code is exactly 16 bits
    if (!/^[01]{16}$/.test(voterRandomBits)) {
      await redisClient.incr("RejectedVotes:2025_president:invalid_binary");
      return res
        .status(400)
        .json({ message: "🚫 Invalid binary code — vote rejected" });
    }
    //  Validate unique vote code
    const codeKey = `voterRandomBits:${voterRandomBits}`;
    const setResult = await redisClient.set(codeKey, "1", {
      NX: true, // only if not exists
      EX: 86400, // expire in 1 day (adjust as needed)
    });

    if (setResult === null) {
      await redisClient.incr("RejectedVotes:2025_president:duplicate_code");
      console.log(`🚫 Duplicate vote code detected: ${voterRandomBits}`);
      return res
        .status(400)
        .json({ message: "🚫 Duplicate vote code — vote rejected" });
    }

    // ✅ Validate candidate exists in MongoDB
    // MUST use findOne — returns null if not found
    const candidate = await addCandidateTable.findOne({
      candidate_name: candidateName,
    });

    if (!candidate) {
      await redisClient.incr("RejectedVotes:2025_president:invalid_candidate");
      console.log(`🚫 [Rejected] Invalid candidate name: ${candidateName}`);
      return res.status(400).json({
        message: "🚫 Invalid candidate name — vote rejected",
      });
    }

    // ✅ 3️⃣ Create Redis-safe key: replace spaces with _
    const safeCandidateName = candidateName.replace(/\s+/g, "_");
    const redisKey = `Votes:2025_president:${safeCandidateName}`;

    try {
      await redisClient.incr(redisKey);

      console.log(`✅ [Accepted] Vote counted for ${candidateName}`);
      return res.status(200).json({
        message: `☑️ Vote counted for: ${candidateName}`,
      });
    } catch (err) {
      console.error("❌ Failed to count vote:", err);
      return res.status(500).json({
        message: "Server error counting vote",
      });
    }
  },

  getVoteCounts: async (req, res) => {
    try {
      const candidate = await addCandidateTable.find();

      let cursor = "0";
      let keys = [];
      const pattern = "Votes:2025_president:*";

      //  Find all Redis keys matching pattern
      do {
        const { cursor: nextCursor, keys: foundKeys } = await redisClient.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          "100"
        );
        cursor = nextCursor; // still string
        keys = keys.concat(foundKeys);
      } while (cursor !== "0");

      // Map Redis keys to an object
      const redisCounts = {};
      for (const key of keys) {
        const count = await redisClient.get(key);
        redisCounts[key] = parseInt(count);
      }

      const results = candidate.map((c) => {
        const safeName = c.candidate_name.replace(/\s+/g, "_");
        const redisKey = `Votes:2025_president:${safeName}`;
        return {
          name: c.candidate_name,
          number: c.candidate_number,
          image: c.candidate_image,
          votes: redisCounts[redisKey] || 0,
        };
      });

      console.log("\n📊 ================================");
      console.log("📊 Current VALID vote counts:");
      console.log(results);
      console.log("📊 ================================");

      res.status(200).json(results);
    } catch (error) {
      console.error("❌ Failed to get vote counts", error);
      res.status(500).json({ message: "Failed to get vote counts 😕" });
    }
  },
};

module.exports = manageShowVoteCtrl;
