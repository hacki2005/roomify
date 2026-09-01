const PROJECT_PREFIX = "roomify_project_";

const jsonError = (status, message, extra = {}) => {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

const getUserId = async (userPuter) => {
  try {
    const user = await userPuter.auth.getUser();

    return user?.uuid || null;
  } catch {
    return null;
  }
};

router.get("/api/projects/list", async ({ user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const listResult = await userPuter.kv.list?.();
    let projects = [];

    if (Array.isArray(listResult)) {
      projects = listResult
        .filter((item) => (item?.key || "").startsWith(PROJECT_PREFIX))
        .map((item) => item?.value ?? item)
        .filter((value) => value !== undefined && value !== null);
    } else if (listResult && typeof listResult === "object") {
      projects = Object.entries(listResult)
        .filter(([key]) => key.startsWith(PROJECT_PREFIX))
        .map(([, value]) => value)
        .filter((value) => value !== undefined && value !== null);
    } else {
      const keys = (await userPuter.kv.keys?.()) ?? [];
      for (const key of keys) {
        if (!key.startsWith(PROJECT_PREFIX)) continue;
        const project = await userPuter.kv.get(key);
        if (project !== undefined && project !== null) projects.push(project);
      }
    }

    return { projects, Projects: projects };
  } catch (e) {
    return jsonError(500, "Failed to list projects", {
      message: e.message || "Unknown error",
    });
  }
});

router.get("/api/projects/get", async ({ request, user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError(400, "Project id is required");

    const key = `${PROJECT_PREFIX}${id}`;
    const project = await userPuter.kv.get(key);

    if (!project) return jsonError(404, "Project not found");

    return project;
  } catch (e) {
    return jsonError(500, "Failed to get project", {
      message: e.message || "Unknown error",
    });
  }
});

router.post(`/api/projects/save`, async ({ request, user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const body = await request.json();
    const project = body?.project;

    if (!project?.id || !project?.sourceImage)
      return jsonError(400, "Project data is missing");

    const payload = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    const userId = await getUserId(userPuter);
    if (!userId) return jsonError(401, "Authentication failed");

    const key = `${PROJECT_PREFIX}${project.id}`;
    await userPuter.kv.set(key, payload);

    return {
      saved: true,
      id: project.id,
      project: payload,
    };
  } catch (e) {
    return jsonError(500, "Failed to save project", {
      message: e.message || "Unknown error",
    });
  }
});
