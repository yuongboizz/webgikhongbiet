import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const url = new URL(req.url);
  const rawGroup = url.searchParams.get("group") || "HOIBANTHAN";
  const groupCode = rawGroup
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32) || "HOIBANTHAN";

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const store = getStore("chot-keo-groups");
    let data = await store.get(groupCode, { type: "json" });

    if (!data || typeof data !== "object") {
      data = { members: {}, availability: {}, ideas: {}, updatedAt: Date.now() };
    }
    data.members = data.members || {};
    data.availability = data.availability || {};
    data.ideas = data.ideas || {};

    if (req.method === "GET") {
      return new Response(
        JSON.stringify({ ok: true, group: groupCode, data }),
        { status: 200, headers }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action, payload } = body || {};

      if (action === "upsert_member" && payload?.member?.id) {
        data.members[payload.member.id] = {
          id: String(payload.member.id).slice(0, 64),
          name: String(payload.member.name || "Bạn ẩn danh").slice(0, 40),
          avatar: String(payload.member.avatar || "😎").slice(0, 8),
          color: String(payload.member.color || "#f97316").slice(0, 16),
          updatedAt: Date.now()
        };
      } else if (action === "set_availability" && payload?.dateKey && payload?.memberId) {
        const dateKey = String(payload.dateKey).slice(0, 16);
        const memberId = String(payload.memberId).slice(0, 64);

        if (!data.availability[dateKey]) {
          data.availability[dateKey] = {};
        }

        if (payload.slotData && Array.isArray(payload.slotData.slots) && payload.slotData.slots.length > 0) {
          data.availability[dateKey][memberId] = {
            slots: payload.slotData.slots.slice(0, 4),
            note: String(payload.slotData.note || "").slice(0, 120),
            updatedAt: Date.now()
          };
        } else {
          delete data.availability[dateKey][memberId];
          if (Object.keys(data.availability[dateKey]).length === 0) {
            delete data.availability[dateKey];
          }
        }
      } else if (action === "add_idea" && payload?.idea?.id) {
        const ideaId = String(payload.idea.id).slice(0, 64);
        data.ideas[ideaId] = {
          id: ideaId,
          title: String(payload.idea.title || "").slice(0, 80),
          location: String(payload.idea.location || "").slice(0, 100),
          dateKey: String(payload.idea.dateKey || "").slice(0, 16),
          authorId: String(payload.idea.authorId || "").slice(0, 64),
          votes: payload.idea.votes || {},
          createdAt: Date.now()
        };
      } else if (action === "toggle_vote" && payload?.ideaId && payload?.memberId) {
        const idea = data.ideas[payload.ideaId];
        if (idea) {
          idea.votes = idea.votes || {};
          if (idea.votes[payload.memberId]) {
            delete idea.votes[payload.memberId];
          } else {
            idea.votes[payload.memberId] = true;
          }
        }
      } else if (action === "delete_idea" && payload?.ideaId) {
        delete data.ideas[payload.ideaId];
      }

      data.updatedAt = Date.now();
      await store.setJSON(groupCode, data);

      return new Response(
        JSON.stringify({ ok: true, group: groupCode, data }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Internal server error" }),
      { status: 500, headers }
    );
  }
};

export const config = {
  path: "/api/sync"
};
