export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Load and save project details
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

    // Upload project images to GitHub
    if (url.pathname === "/api/upload") {
      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 }
        );
      }

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

      if (!env.GITHUB_TOKEN) {
        return Response.json(
          { error: "GITHUB_TOKEN secret is missing" },
          { status: 500 }
        );
      }

      try {
        const form = await request.formData();
        const image = form.get("image");

        if (!image || typeof image.arrayBuffer !== "function") {
          return Response.json(
            { error: "Please select an image" },
            { status: 400 }
          );
        }

        if (image.size > 5 * 1024 * 1024) {
          return Response.json(
            { error: "Image must be 5 MB or smaller" },
            { status: 413 }
          );
        }

        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif"
        ];

        if (!allowedTypes.includes(image.type)) {
          return Response.json(
            { error: "Unsupported image type" },
            { status: 400 }
          );
        }

        const extension = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif"
        }[image.type];

        const originalName = (image.name || "project")
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "-")
          .slice(0, 50) || "project";

        const filename =
          `${Date.now()}-${originalName}.${extension}`;

        const path = `images/projects/${filename}`;
        const bytes = new Uint8Array(await image.arrayBuffer());

        let binary = "";
        const chunkSize = 8192;

        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize)
          );
        }

        const content = btoa(binary);

        const githubResponse = await fetch(
          `https://api.github.com/repos/asthadesignbd-svg/astha-design-interiors/contents/${path}`,
          {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: `Upload project image ${filename}`,
              content,
              branch: "main"
            })
          }
        );

        if (!githubResponse.ok) {
          const details = await githubResponse.text();

          return Response.json(
            {
              error: "GitHub image upload failed",
              details: details.slice(0, 500)
            },
            { status: 502 }
          );
        }

        return Response.json({
          success: true,
          path,
          url: `https://raw.githubusercontent.com/asthadesignbd-svg/astha-design-interiors/main/${path}`
        });
      } catch (error) {
        return Response.json(
          {
            error: "Image upload failed",
            details: String(error.message || error)
          },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
