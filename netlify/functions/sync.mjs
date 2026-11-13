import { getStore } from "@netlify/blobs";

function buildClientPayload(groupCode, data) {
  return {
    ok: true,
    unchanged: false,
    group: groupCode,
    hasAdmin: Boolean(data.adminPin),
    data: {
      members: data.members || {},
      availability: data.availability || {},
      ideas: data.ideas || {},
      updatedAt: data.updatedAt || Date.now()
    }
  };
}

export default async (req, context) => {
  const url = new URL(req.url);
  const rawGroup = url.searchParams.get("group") || "HOIBANTHAN";
  const sinceParam = url.searchParams.get("since");
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
      data = {
        adminPin: null,
        members: {},
        availability: {},
        ideas: {},
        updatedAt: Date.now()
      };
    }
    data.members = data.members || {};
    data.availability = data.availability || {};
    data.ideas = data.ideas || {};
    data.updatedAt = Number(data.updatedAt || Date.now());

    if (req.method === "GET") {
      const clientSince = Number(sinceParam || 0);
      if (clientSince > 0 && clientSince >= data.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            unchanged: true,
            hasAdmin: Boolean(data.adminPin),
            updatedAt: data.updatedAt
          }),
          { status: 200, headers }
        );
      }

      return new Response(
        JSON.stringify(buildClientPayload(groupCode, data)),
        { status: 200, headers }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action, payload } = body || {};

      // =====================================
      // ADMIN AUTHENTICATION & PIN MANAGEMENT
      // =====================================
      if (action === "admin_setup_or_verify") {
        const pin = String(payload?.pin || "").trim().slice(0, 32);
        if (pin.length < 4) {
          return new Response(
            JSON.stringify({ ok: false, error: "Mã PIN Admin cần tối thiểu 4 ký tự!" }),
            { status: 400, headers }
          );
        }

        if (!data.adminPin) {
          data.adminPin = pin;
          data.updatedAt = Date.now();
          await store.setJSON(groupCode, data);
          return new Response(
            JSON.stringify({ ...buildClientPayload(groupCode, data), isAdmin: true }),
            { status: 200, headers }
          );
        }

        if (data.adminPin !== pin) {
          return new Response(
            JSON.stringify({ ok: false, error: "Sai mã PIN Admin!" }),
            { status: 403, headers }
          );
        }

        return new Response(
          JSON.stringify({ ...buildClientPayload(groupCode, data), isAdmin: true }),
          { status: 200, headers }
        );
      }

      if (action && action.startsWith("admin_")) {
        const providedPin = String(payload?.adminPin || "").trim();
        if (!data.adminPin || data.adminPin !== providedPin) {
          return new Response(
            JSON.stringify({ ok: false, error: "Không có quyền Admin hoặc sai mã PIN!" }),
            { status: 403, headers }
          );
        }

        if (action === "admin_change_pin") {
          const newPin = String(payload?.newPin || "").trim().slice(0, 32);
          if (newPin.length < 4) {
            return new Response(
              JSON.stringify({ ok: false, error: "Mã PIN mới cần tối thiểu 4 ký tự!" }),
              { status: 400, headers }
            );
          }
          data.adminPin = newPin;
        } else if (action === "admin_set_availability" && payload?.dateKey && payload?.memberId) {
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
        } else if (action === "admin_clear_day" && payload?.dateKey) {
          const dateKey = String(payload.dateKey).slice(0, 16);
          delete data.availability[dateKey];
        } else if (action === "admin_edit_member" && payload?.memberId) {
          const memberId = String(payload.memberId).slice(0, 64);
          if (data.members[memberId]) {
            data.members[memberId].name = String(payload.name || data.members[memberId].name).slice(0, 40);
            if (payload.avatar) data.members[memberId].avatar = String(payload.avatar).slice(0, 8);
            if (payload.color) data.members[memberId].color = String(payload.color).slice(0, 16);
            data.members[memberId].updatedAt = Date.now();
          }
        } else if (action === "admin_delete_member" && payload?.memberId) {
          const memberId = String(payload.memberId).slice(0, 64);
          delete data.members[memberId];

          for (const dk of Object.keys(data.availability)) {
            if (data.availability[dk]?.[memberId]) {
              delete data.availability[dk][memberId];
              if (Object.keys(data.availability[dk]).length === 0) {
                delete data.availability[dk];
              }
            }
          }

          for (const ideaId of Object.keys(data.ideas)) {
            if (data.ideas[ideaId]?.votes?.[memberId]) {
              delete data.ideas[ideaId].votes[memberId];
            }
          }
        } else if (action === "admin_edit_idea" && payload?.ideaId) {
          const ideaId = String(payload.ideaId).slice(0, 64);
          if (data.ideas[ideaId]) {
            data.ideas[ideaId].title = String(payload.title || data.ideas[ideaId].title).slice(0, 80);
            data.ideas[ideaId].location = String(payload.location ?? data.ideas[ideaId].location).slice(0, 100);
            data.ideas[ideaId].dateKey = String(payload.dateKey ?? data.ideas[ideaId].dateKey).slice(0, 16);
          }
        } else if (action === "admin_delete_idea" && payload?.ideaId) {
          delete data.ideas[String(payload.ideaId).slice(0, 64)];
        } else if (action === "admin_clear_all_ideas") {
          data.ideas = {};
        }

        data.updatedAt = Date.now();
        await store.setJSON(groupCode, data);
        return new Response(
          JSON.stringify({ ...buildClientPayload(groupCode, data), isAdmin: true }),
          { status: 200, headers }
        );
      }

      // =====================================
      // STANDARD MEMBER ACTIONS
      // =====================================
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
        JSON.stringify(buildClientPayload(groupCode, data)),
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
