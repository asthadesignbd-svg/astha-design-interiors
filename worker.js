export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/projects") {
      if (!env.ASTHA_PROJECTS) {
        return Response.json(
          { error: "KV binding is missing" },
          { status: 500 }
        );
      }

      if (request.method === "GET") {
        const data = await env.ASTHA_PROJECTS.get("projects");
        return Response.json(data ? JSON.parse(data) : []);
      }

      if (request.method === "PUT") {
        const password = env.ADMIN_PASSWORD;

        if (
          !password ||
          request.headers.get("Authorization") !== `Bearer ${password}`
        ) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 }
          );
        }

        try {
          const projects = await request.json();

          if (!Array.isArray(projects)) {
            return Response.json(
              { error: "Expected a projects array" },
              { status: 400 }
            );
          }

          await env.ASTHA_PROJECTS.put(
            "projects",
            JSON.stringify(projects)
          );

          return Response.json({ success: true });
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400 }
          );
        }
      }

      return Response.json(
        { error: "Method not allowed" },
        { status: 405 }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
