// lib/openapi.ts
//
// Central OpenAPI 3.0 specification for all ScriptOverNovel Music API routes.
// Served at GET /api/openapi.json → rendered by the Swagger UI at
// /admin/api-docs.
//
// Auth: every admin-only endpoint accepts either:
//   • An active session cookie  (browser admin panel)
//   • X-API-Key header          (API_SECRET_KEY env var)
// Public endpoints require neither.

import type { OpenAPIV3 } from "openapi-types";

// ─── Shared schema fragments ──────────────────────────────────────────────────

const IdParam: OpenAPIV3.ParameterObject = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Record ID (cuid)",
};

const SuccessResponse: OpenAPIV3.ResponseObject = {
  description: "Success",
  content: {
    "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } },
  },
};

const ErrorResponse: OpenAPIV3.ResponseObject = {
  description: "Error",
  content: {
    "application/json": {
      schema: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
    },
  },
};

const adminSecurity: OpenAPIV3.SecurityRequirementObject[] = [
  { sessionAuth: [] },
  { apiKey: [] },
];

// ─── Full spec ────────────────────────────────────────────────────────────────

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "ScriptOverNovel Music API",
    version: "1.0.0",
    description:
      "Internal REST API for the ScriptOverNovel Music portfolio & shop. Admin endpoints " +
      "require either an active session cookie or the `x-api-key` header.",
    contact: { name: "ScriptOverNovel Music Admin" },
  },
  servers: [{ url: "/api", description: "Current deployment" }],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: "apiKey",
        in: "cookie",
        name: "authjs.session-token",
        description: "NextAuth.js session cookie (set automatically after login)",
      },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Static API key — set `API_SECRET_KEY` in your environment variables",
      },
    },
    schemas: {
      ShimmerSettings: {
        type: "object",
        description:
          "One public grid's hover light-sweep — see Profile.hoverShimmer and lib/hover-shimmer.ts.",
        properties: {
          color: { type: "string", description: "Six-digit hex, e.g. \"#FFFFFF\"." },
          speed: { type: "number", description: "Seconds per sweep, 0.5–6. Lower is faster." },
          brightness: {
            type: "integer",
            description: "0–100. Peak opacity of the band; 0 turns the sweep off for that grid.",
          },
        },
      },
      Artwork: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          imageUrl: { type: "string", format: "uri" },
          imageUrls: { type: "array", items: { type: "string" } },
          videoUrl: { type: "string", nullable: true },
          videoUrls: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          medium: { type: "string", nullable: true },
          dimensions: { type: "string", nullable: true },
          year: { type: "integer", nullable: true },
          featured: { type: "boolean" },
          isNewRelease: { type: "boolean" },
          published: { type: "boolean" },
          status: { type: "string", enum: ["AVAILABLE", "SOLD", "RESERVED", "NOT_FOR_SALE"] },
          shareCount: { type: "integer" },
          sectionId: { type: "string", nullable: true },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      StoryPage: {
        type: "object",
        properties: {
          id: { type: "string" },
          storyId: { type: "string" },
          imageUrl: { type: "string", format: "uri" },
          pageNumber: { type: "integer", description: "1-based, always contiguous" },
          caption: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Story: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          slug: { type: "string", nullable: true },
          description: { type: "string" },
          type: {
            type: "string",
            enum: ["BOOK", "NOVEL", "COMIC", "MANGA", "ANTHOLOGY", "ARTBOOK", "ZINE", "WEBTOON"],
          },
          coverImageUrl: { type: "string", format: "uri" },
          author: { type: "string", nullable: true },
          genre: { type: "array", items: { type: "string" } },
          year: { type: "integer", nullable: true },
          featured: { type: "boolean" },
          published: { type: "boolean" },
          displayOrder: { type: "integer" },
          continueEnabled: { type: "boolean", description: "Show a Continue Reading button after the last page" },
          continueUrl: { type: "string", nullable: true, description: "http(s) only \u2014 validated on write" },
          continueLabel: { type: "string", nullable: true, description: "Button copy; null renders the default" },
          pages: { type: "array", items: { $ref: "#/components/schemas/StoryPage" } },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Cosplay: {
        type: "object",
        description:
          "One costume, shown on a standee in the Digital Museum's Cosplay Room with its backdrop photo hung behind it.",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          slug: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          character: { type: "string", nullable: true, description: "Shown on the standee's plaque" },
          series: { type: "string", nullable: true },
          standeeImageUrl: {
            type: "string",
            format: "uri",
            description: "Printed on the standee \u2014 a full-length portrait, rendered roughly life-size",
          },
          backdropImageUrl: {
            type: "string",
            format: "uri",
            nullable: true,
            description: "Hung on the panel behind the standee; null leaves that panel out",
          },
          cosplayer: { type: "string", nullable: true },
          photographer: { type: "string", nullable: true },
          year: { type: "integer", nullable: true },
          event: { type: "string", nullable: true },
          published: { type: "boolean", description: "Published cosplays get a standee in the Cosplay Room" },
          displayOrder: { type: "integer", description: "Order standees are placed around the room's walls" },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          artworkId: { type: "string" },
          price: { type: "number" },
          stock: { type: "integer" },
          available: { type: "boolean" },
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                price: { type: "number" },
                stock: { type: "integer" },
                sortOrder: { type: "integer" },
              },
            },
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          customerName: { type: "string" },
          customerEmail: { type: "string" },
          total: { type: "number" },
          status: {
            type: "string",
            enum: ["PENDING", "PAID", "FAILED", "CANCELLED", "SHIPPED", "DELIVERED"],
          },
          paymongoRef: { type: "string" },
          shippingAddress: { type: "string" },
          shippingPhone: { type: "string" },
          deliveryNotes: { type: "string", nullable: true },
          archivedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description:
              "When the admin filed this order out of the active Orders list. " +
              "Not a soft delete — archived orders still count towards revenue and exports.",
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Announcement: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          message: { type: "string", nullable: true },
          imageUrl: { type: "string", nullable: true },
          linkUrl: { type: "string", nullable: true },
          linkLabel: { type: "string" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          isHidden: { type: "boolean" },
          priority: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Section: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          coverImageUrl: { type: "string", nullable: true },
          isPublished: { type: "boolean" },
          displayOrder: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      FAQ: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          isActive: { type: "boolean" },
          displayOrder: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ReleaseTrack: {
        type: "object",
        properties: {
          id: { type: "string" },
          trackNumber: { type: "integer" },
          title: { type: "string" },
          durationSec: { type: "integer", nullable: true },
          url: { type: "string", nullable: true, description: "Optional per-track streaming link (any provider lib/embeds.ts parses)." },
          lyrics: { type: "string", nullable: true },
        },
      },
      Release: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          slug: { type: "string", nullable: true, description: "Write-once; the /music#slug anchor." },
          type: { type: "string", enum: ["SINGLE", "EP", "ALBUM", "LIVE", "COMPILATION"] },
          coverImageUrl: { type: "string" },
          releaseDate: { type: "string", format: "date-time", nullable: true },
          description: { type: "string", nullable: true },
          featured: { type: "boolean", description: "Fronts the homepage hero." },
          published: { type: "boolean" },
          sortOrder: { type: "integer" },
          spotifyUrl: { type: "string", nullable: true },
          bandcampUrl: { type: "string", nullable: true },
          youtubeUrl: { type: "string", nullable: true },
          soundcloudUrl: { type: "string", nullable: true },
          appleMusicUrl: { type: "string", nullable: true },
          primaryPlayer: { type: "string", nullable: true, enum: ["spotify", "bandcamp", "youtube", "soundcloud", "applemusic", null], description: "Which platform's embedded player the site shows; null = first that can embed." },
          tracks: { type: "array", items: { $ref: "#/components/schemas/ReleaseTrack" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Video: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          youtubeUrl: { type: "string", description: "The pasted YouTube link (watch / youtu.be / shorts)." },
          youtubeId: { type: "string", description: "Derived 11-char id; thumbnails and the player use this." },
          kind: { type: "string", enum: ["MUSIC_VIDEO", "LIVE", "BEHIND_THE_SCENES"] },
          releaseId: { type: "string", nullable: true },
          release: { type: "object", nullable: true, properties: { id: { type: "string" }, title: { type: "string" }, slug: { type: "string", nullable: true } } },
          description: { type: "string", nullable: true },
          published: { type: "boolean" },
          featured: { type: "boolean", description: "Leads the homepage strip and the Videos page." },
          sortOrder: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Event: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          venueName: { type: "string", nullable: true },
          latitude: { type: "number" },
          longitude: { type: "number" },
          eventDate: { type: "string", format: "date-time", nullable: true },
          isNextEvent: { type: "boolean" },
          displayOrder: { type: "integer" },
          enabled: { type: "boolean" },
          media: { type: "array", items: { $ref: "#/components/schemas/EventMedia" } },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      EventMedia: {
        type: "object",
        properties: {
          id: { type: "string" },
          eventId: { type: "string" },
          url: { type: "string" },
          type: { type: "string", enum: ["IMAGE", "VIDEO"] },
          order: { type: "integer" },
        },
      },
      Marquee: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          category: { type: "string" },
          isActive: { type: "boolean" },
          priority: { type: "integer" },
          startDate: { type: "string", format: "date-time", nullable: true },
          endDate: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      MuseumRoom: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string", nullable: true },
          roomType: { type: "string", enum: ["MAIN_HALL", "GALLERY", "SPECIAL_EXHIBITION", "ABOUT", "FREEDOM_WALL", "STAIRS"] },
          displayOrder: { type: "integer" },
          enabled: { type: "boolean" },
          isEntryRoom: { type: "boolean" },
          floor: { type: "integer", description: "0 = ground floor, 1 = second floor. See docs/SecondFloorStairs_Spec.md." },
          wallColor: { type: "string" },
          floorColor: { type: "string" },
          ceilingColor: { type: "string" },
          splashIcon: { type: "string", nullable: true },
          splashTitle: { type: "string", nullable: true },
        },
      },
      MuseumAchievement: {
        type: "object",
        properties: {
          id: { type: "string" },
          category: { type: "string", enum: ["time", "views", "wishlist", "steps"] },
          threshold: { type: "integer" },
          reward: { type: "string" },
          enabled: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      MiniGame: {
        type: "object",
        properties: {
          type: { type: "string" },
          name: { type: "string" },
          enabled: { type: "boolean" },
          difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
          timeLimitSec: { type: "integer" },
          leaderboardEnabled: { type: "boolean" },
          rewardEnabled: { type: "boolean" },
          rewardDescription: { type: "string", nullable: true },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["ORDER", "HIGHSCORE", "CONTACT", "MUSEUM"] },
          title: { type: "string" },
          body: { type: "string" },
          metadata: { type: "object" },
          readAt: { type: "string", format: "date-time", nullable: true },
          isSpam: { type: "boolean" },
          isArchived: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      VisitorMilestone: {
        type: "object",
        properties: {
          id: { type: "string" },
          threshold: { type: "integer" },
          reward: { type: "string" },
          enabled: { type: "boolean" },
          achievedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Certificate: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          issuer: { type: "string", nullable: true },
          dateAwarded: { type: "string", format: "date-time", nullable: true },
          description: { type: "string", nullable: true },
          imageUrl: { type: "string", nullable: true },
          displayOrder: { type: "integer" },
        },
      },
      ChaseCompanion: {
        type: "object",
        properties: {
          id: { type: "string" },
          assetType: { type: "string", enum: ["model", "image"] },
          assetUrl: { type: "string" },
          enabled: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    // ═══════════════════════════════════════════════════════
    // ARTWORKS
    // ═══════════════════════════════════════════════════════
    "/artworks": {
      get: {
        tags: ["Artworks"],
        summary: "List all artworks",
        description: "Public. Supports query filters: published, tag, featured, newRelease.",
        parameters: [
          { name: "published", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "tag", in: "query", schema: { type: "string" } },
          { name: "featured", in: "query", schema: { type: "string", enum: ["true"] } },
          { name: "newRelease", in: "query", schema: { type: "string", enum: ["true"] } },
        ],
        responses: {
          "200": {
            description: "Array of artworks",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Artwork" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Artworks"],
        summary: "Create artwork",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description", "imageUrl"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  imageUrl: { type: "string" },
                  imageUrls: { type: "array", items: { type: "string" } },
                  videoUrl: { type: "string" },
                  videoUrls: { type: "array", items: { type: "string" } },
                  tags: { type: "array", items: { type: "string" } },
                  medium: { type: "string" },
                  dimensions: { type: "string" },
                  year: { type: "integer" },
                  featured: { type: "boolean" },
                  isNewRelease: { type: "boolean" },
                  published: { type: "boolean" },
                  status: { type: "string", enum: ["AVAILABLE", "SOLD", "RESERVED", "NOT_FOR_SALE"] },
                  sectionId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created artwork", content: { "application/json": { schema: { $ref: "#/components/schemas/Artwork" } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/artworks/{id}": {
      get: {
        tags: ["Artworks"],
        summary: "Get artwork by ID",
        parameters: [IdParam],
        responses: {
          "200": { description: "Artwork", content: { "application/json": { schema: { $ref: "#/components/schemas/Artwork" } } } },
          "404": ErrorResponse,
        },
      },
      patch: {
        tags: ["Artworks"],
        summary: "Update artwork",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  imageUrl: { type: "string" },
                  imageUrls: { type: "array", items: { type: "string" } },
                  videoUrl: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  medium: { type: "string" },
                  dimensions: { type: "string" },
                  year: { type: "integer" },
                  featured: { type: "boolean" },
                  isNewRelease: { type: "boolean" },
                  published: { type: "boolean" },
                  status: { type: "string", enum: ["AVAILABLE", "SOLD", "RESERVED", "NOT_FOR_SALE"] },
                  sectionId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated artwork", content: { "application/json": { schema: { $ref: "#/components/schemas/Artwork" } } } },
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
      delete: {
        tags: ["Artworks"],
        summary: "Soft-delete artwork (moves to trash)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/artworks/{id}/share": {
      post: {
        tags: ["Artworks"],
        summary: "Increment share count",
        description: "Public — no auth. Fired by ShareButton when a visitor completes a share action.",
        parameters: [IdParam],
        responses: {
          "200": {
            description: "Updated share count",
            content: { "application/json": { schema: { type: "object", properties: { shareCount: { type: "integer" } } } } },
          },
          "404": ErrorResponse,
        },
      },
    },
    "/artworks/availability": {
      get: {
        tags: ["Artworks"],
        summary: "Check whether saved artwork ids are still public",
        description:
          "Public — no auth. Used by the Wishlist page, which is a localStorage snapshot " +
          "that can outlive the artwork it was saved from. For each id in `ids` " +
          "(comma-separated, max 200), reports whether it still passes the exact gate the " +
          "artwork detail page itself uses (published, not deleted) — i.e. whether clicking " +
          "through would still work. An id that doesn't exist at all reports the same as one " +
          "that's since been deleted or unpublished: `false`.",
        parameters: [
          { name: "ids", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated artwork ids." },
        ],
        responses: {
          "200": {
            description: "Map of artwork id → still available",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: { type: "boolean" } },
              },
            },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // STORIES
    // ═══════════════════════════════════════════════════════
    "/stories": {
      get: {
        tags: ["Tales"],
        summary: "List all tales",
        description: "Public. Supports query filters: published, featured, type, genre.",
        parameters: [
          { name: "published", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "featured", in: "query", schema: { type: "string", enum: ["true"] } },
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["BOOK", "NOVEL", "COMIC", "MANGA", "ANTHOLOGY", "ARTBOOK", "ZINE", "WEBTOON"],
            },
          },
          { name: "genre", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Array of tales",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Story" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Tales"],
        summary: "Create tale",
        description:
          "Cover and page images must already be uploaded via POST /upload — this endpoint stores URLs only.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description", "coverImageUrl"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["BOOK", "NOVEL", "COMIC", "MANGA", "ANTHOLOGY", "ARTBOOK", "ZINE", "WEBTOON"],
                  },
                  coverImageUrl: { type: "string" },
                  author: { type: "string" },
                  genre: { type: "array", items: { type: "string" } },
                  year: { type: "integer" },
                  featured: { type: "boolean" },
                  published: { type: "boolean" },
                  displayOrder: { type: "integer" },
                  continueEnabled: { type: "boolean" },
                  continueUrl: { type: "string" },
                  continueLabel: { type: "string" },
                  pages: {
                    type: "array",
                    description: "Optional initial pages, in reading order.",
                    items: {
                      type: "object",
                      properties: {
                        imageUrl: { type: "string" },
                        caption: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created story", content: { "application/json": { schema: { $ref: "#/components/schemas/Story" } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/stories/{id}": {
      get: {
        tags: ["Tales"],
        summary: "Get tale by ID",
        parameters: [IdParam],
        responses: {
          "200": { description: "Story", content: { "application/json": { schema: { $ref: "#/components/schemas/Story" } } } },
          "404": ErrorResponse,
        },
      },
      patch: {
        tags: ["Tales"],
        summary: "Update tale",
        description: "Slug is set on create and never changed here — shared links stay valid.",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["BOOK", "NOVEL", "COMIC", "MANGA", "ANTHOLOGY", "ARTBOOK", "ZINE", "WEBTOON"],
                  },
                  coverImageUrl: { type: "string" },
                  author: { type: "string" },
                  genre: { type: "array", items: { type: "string" } },
                  year: { type: "integer" },
                  featured: { type: "boolean" },
                  published: { type: "boolean" },
                  displayOrder: { type: "integer" },
                  continueEnabled: { type: "boolean" },
                  continueUrl: { type: "string" },
                  continueLabel: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated story", content: { "application/json": { schema: { $ref: "#/components/schemas/Story" } } } },
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
      delete: {
        tags: ["Tales"],
        summary: "Soft-delete tale (moves to trash)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/stories/{id}/pages": {
      post: {
        tags: ["Tales"],
        summary: "Append page(s) to a tale",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  pages: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["imageUrl"],
                      properties: {
                        imageUrl: { type: "string" },
                        caption: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Story with its updated pages", content: { "application/json": { schema: { $ref: "#/components/schemas/Story" } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
      put: {
        tags: ["Tales"],
        summary: "Reorder a tale's pages",
        description:
          "Body must list every page id of the tale exactly once, in the new reading order; pageNumber is re-normalized to 1..n.",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["pageIds"],
                properties: { pageIds: { type: "array", items: { type: "string" } } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Story with its reordered pages", content: { "application/json": { schema: { $ref: "#/components/schemas/Story" } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
    },
    "/stories/{id}/pages/{pageId}": {
      patch: {
        tags: ["Tales"],
        summary: "Update a page's caption",
        security: adminSecurity,
        parameters: [
          IdParam,
          { name: "pageId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { caption: { type: "string", nullable: true } } },
            },
          },
        },
        responses: {
          "200": { description: "Story with its updated pages", content: { "application/json": { schema: { $ref: "#/components/schemas/Story" } } } },
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
      delete: {
        tags: ["Tales"],
        summary: "Delete one page permanently",
        description: "Remaining pages are renumbered to stay contiguous.",
        security: adminSecurity,
        parameters: [
          IdParam,
          { name: "pageId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Story with its remaining pages", content: { "application/json": { schema: { $ref: "#/components/schemas/Story" } } } },
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // COSPLAYS
    // ═══════════════════════════════════════════════════════
    "/cosplays": {
      get: {
        tags: ["Cosplays"],
        summary: "List all cosplays",
        description:
          "Public. Supports the `published` filter. Ordered by displayOrder \u2014 the same order their standees are placed around the Cosplay Room's walls.",
        parameters: [
          { name: "published", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        ],
        responses: {
          "200": {
            description: "Array of cosplays",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Cosplay" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["Cosplays"],
        summary: "Create cosplay",
        description:
          "Both photos must already be uploaded via POST /upload \u2014 this endpoint stores URLs only. Publishing one gives it a standee in the museum's Cosplay Room on the next load (see lib/museum/cosplayRoom.ts).",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "standeeImageUrl"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  character: { type: "string" },
                  series: { type: "string" },
                  standeeImageUrl: { type: "string" },
                  backdropImageUrl: { type: "string" },
                  cosplayer: { type: "string" },
                  photographer: { type: "string" },
                  year: { type: "integer" },
                  event: { type: "string" },
                  published: { type: "boolean" },
                  displayOrder: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created cosplay", content: { "application/json": { schema: { $ref: "#/components/schemas/Cosplay" } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/cosplays/{id}": {
      get: {
        tags: ["Cosplays"],
        summary: "Get cosplay by ID",
        parameters: [IdParam],
        responses: {
          "200": { description: "Cosplay", content: { "application/json": { schema: { $ref: "#/components/schemas/Cosplay" } } } },
          "404": ErrorResponse,
        },
      },
      patch: {
        tags: ["Cosplays"],
        summary: "Update cosplay",
        description:
          "Slug is set on create and never changed here. Unpublishing removes this cosplay's standee from the Cosplay Room, along with any Scene Editor placement it was carrying.",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  character: { type: "string" },
                  series: { type: "string" },
                  standeeImageUrl: { type: "string" },
                  backdropImageUrl: { type: "string" },
                  cosplayer: { type: "string" },
                  photographer: { type: "string" },
                  year: { type: "integer" },
                  event: { type: "string" },
                  published: { type: "boolean" },
                  displayOrder: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated cosplay", content: { "application/json": { schema: { $ref: "#/components/schemas/Cosplay" } } } },
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
      delete: {
        tags: ["Cosplays"],
        summary: "Soft-delete cosplay (moves to trash)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // SECTIONS
    // ═══════════════════════════════════════════════════════
    "/sections": {
      get: {
        tags: ["Sections"],
        summary: "List all sections",
        responses: {
          "200": { description: "Sections", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Section" } } } } },
        },
      },
      post: {
        tags: ["Sections"],
        summary: "Create section",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  coverImageUrl: { type: "string" },
                  isPublished: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created section" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/sections/reorder": {
      put: {
        tags: ["Sections"],
        summary: "Batch reorder sections",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["order"],
                properties: {
                  order: { type: "array", items: { type: "object", properties: { id: { type: "string" }, displayOrder: { type: "integer" } } } },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated sections list" }, "401": ErrorResponse },
      },
    },
    "/sections/{id}": {
      get: {
        tags: ["Sections"],
        summary: "Get section with artworks",
        parameters: [IdParam],
        responses: { "200": { description: "Section with artworks" }, "404": ErrorResponse },
      },
      patch: {
        tags: ["Sections"],
        summary: "Update section",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  coverImageUrl: { type: "string" },
                  isPublished: { type: "boolean" },
                  displayOrder: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated section" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Sections"],
        summary: "Soft-delete section (cascades to artworks & products)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // PRODUCTS
    // ═══════════════════════════════════════════════════════
    "/site-search": {
      get: {
        tags: ["Products"],
        summary: "Header search catalogue (public)",
        description:
          "Everything the public header search can match — flat rows with `kind` (release | video | merch), `title`, `subtitle`, `keywords`, `imageUrl`, `href`. Merch today; releases and videos as those modules land. Filtered client-side.",
        responses: { "200": { description: "{ items: SiteSearchItem[] }" } },
      },
    },
    "/products": {
      get: {
        tags: ["Products"],
        summary: "List all products",
        responses: {
          "200": { description: "Products", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Product" } } } } },
        },
      },
      post: {
        tags: ["Products"],
        summary: "Create product for an artwork",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["artworkId", "price"],
                properties: {
                  artworkId: { type: "string" },
                  price: { type: "number" },
                  stock: { type: "integer" },
                  variants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { label: { type: "string" }, price: { type: "number" }, stock: { type: "integer" } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created product" }, "400": ErrorResponse, "401": ErrorResponse, "409": ErrorResponse },
      },
    },
    "/products/{id}": {
      patch: {
        tags: ["Products"],
        summary: "Update product price/stock/variants",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  price: { type: "number" },
                  stock: { type: "integer" },
                  available: { type: "boolean" },
                  variants: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated product" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Products"],
        summary: "Soft-delete product",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/products/availability": {
      get: {
        tags: ["Products"],
        summary: "Check whether saved product ids are still buyable",
        description:
          "Public — no auth. Used by the Cart and Checkout pages, both localStorage " +
          "snapshots that can outlive the product they were added from. For each id in " +
          "`ids` (comma-separated, max 200), reports whether it still passes the exact " +
          "gate the Shop listing itself uses (available, not deleted, and its artwork not " +
          "deleted) — i.e. whether it would still show up in the Shop. `POST /checkout` " +
          "re-checks the same thing server-side at order time regardless of what this " +
          "reports; this only drives what the Cart/Checkout UI shows beforehand.",
        parameters: [
          { name: "ids", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated product ids." },
        ],
        responses: {
          "200": {
            description: "Map of product id → still buyable",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: { type: "boolean" } },
              },
            },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ORDERS
    // ═══════════════════════════════════════════════════════
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "List all orders (admin)",
        security: adminSecurity,
        responses: {
          "200": { description: "Orders", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Order" } } } } },
          "401": ErrorResponse,
        },
      },
    },
    "/orders/{id}": {
      patch: {
        tags: ["Orders"],
        summary: "Update order status and/or archive state",
        description:
          "Send `status`, `archived`, or both — at least one is required. " +
          "Archiving only files the order out of the admin's active list: it keeps " +
          "counting towards revenue, the Sales Dashboard and every export, and is " +
          "reversible with `archived: false`. Orders are never deleted.",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                minProperties: 1,
                properties: {
                  status: { type: "string", enum: ["PENDING", "PAID", "FAILED", "CANCELLED", "SHIPPED", "DELIVERED"] },
                  archived: { type: "boolean", description: "true sets archivedAt to now, false clears it" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated order" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/orders/{id}/receipt": {
      get: {
        tags: ["Orders"],
        summary: "Printable HTML receipt for one order",
        description:
          "Returns a self-contained HTML document (inline, not an attachment) that " +
          "prints itself on load — the admin's \"Download Receipt\" button opens it in " +
          "a new tab and the browser's print dialog saves it as PDF.",
        security: adminSecurity,
        parameters: [IdParam],
        responses: {
          "200": {
            description: "Receipt document",
            content: { "text/html": { schema: { type: "string" } } },
          },
          "401": ErrorResponse,
          "404": ErrorResponse,
        },
      },
    },
    "/orders/lookup": {
      post: {
        tags: ["Orders"],
        summary: "Public order status lookup by email + reference",
        description: "No auth required. Customer checks their order using email + KAL-... reference number.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "reference"],
                properties: {
                  email: { type: "string", format: "email" },
                  reference: { type: "string", example: "KAL-1234567890-ABCD1234" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Order details" },
          "400": ErrorResponse,
          "404": ErrorResponse,
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // CHECKOUT & WEBHOOKS
    // ═══════════════════════════════════════════════════════
    "/checkout": {
      post: {
        tags: ["Checkout"],
        summary: "Create PayMongo checkout session",
        description:
          "Public. Validates each product server-side — available, not deleted, its artwork " +
          "not deleted, and stock covers the requested quantity — before creating an Order " +
          "record and returning a PayMongo checkout URL. A product that fails any of those " +
          "(including one that's since been deleted or paused, which a stale cart can't tell " +
          "apart from the id simply not existing) fails the whole request with 400, same as " +
          "one that's out of stock.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["customerName", "customerEmail", "shippingAddress", "shippingPhone", "items"],
                properties: {
                  customerName: { type: "string" },
                  customerEmail: { type: "string", format: "email" },
                  shippingAddress: { type: "string" },
                  shippingPhone: { type: "string" },
                  deliveryNotes: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["productId", "quantity"],
                      properties: {
                        productId: { type: "string" },
                        variantId: { type: "string" },
                        quantity: { type: "integer", minimum: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Checkout session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orderId: { type: "string" },
                    checkoutUrl: { type: "string", format: "uri" },
                    referenceNumber: { type: "string" },
                  },
                },
              },
            },
          },
          "400": ErrorResponse,
        },
      },
    },
    "/webhooks/paymongo": {
      post: {
        tags: ["Checkout"],
        summary: "PayMongo webhook receiver",
        description: "Called by PayMongo. Verifies signature, marks orders PAID/FAILED, decrements stock.",
        responses: {
          "200": { description: "Webhook received", content: { "application/json": { schema: { type: "object", properties: { received: { type: "boolean" } } } } } },
          "401": ErrorResponse,
          "500": ErrorResponse,
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ANNOUNCEMENTS
    // ═══════════════════════════════════════════════════════
    "/announcements": {
      get: {
        tags: ["Announcements"],
        summary: "List all announcements (admin)",
        responses: {
          "200": { description: "Announcements", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Announcement" } } } } },
        },
      },
      post: {
        tags: ["Announcements"],
        summary: "Create announcement",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "startDate", "endDate"],
                properties: {
                  title: { type: "string" },
                  message: { type: "string" },
                  imageUrl: { type: "string" },
                  linkUrl: { type: "string" },
                  linkLabel: { type: "string" },
                  startDate: { type: "string", format: "date-time" },
                  endDate: { type: "string", format: "date-time" },
                  isHidden: { type: "boolean" },
                  priority: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/announcements/active": {
      get: {
        tags: ["Announcements"],
        summary: "Get top active announcement (public)",
        description: "Returns the highest-priority live announcement, or null if none.",
        responses: { "200": { description: "Active announcement or null" } },
      },
    },
    "/announcements/{id}": {
      get: {
        tags: ["Announcements"],
        summary: "Get announcement by ID",
        parameters: [IdParam],
        responses: { "200": { description: "Announcement" }, "404": ErrorResponse },
      },
      patch: {
        tags: ["Announcements"],
        summary: "Update announcement",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  message: { type: "string" },
                  startDate: { type: "string", format: "date-time" },
                  endDate: { type: "string", format: "date-time" },
                  isHidden: { type: "boolean" },
                  priority: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Announcements"],
        summary: "Soft-delete announcement",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // MARQUEES
    // ═══════════════════════════════════════════════════════
    "/marquees": {
      get: {
        tags: ["Marquees"],
        summary: "List all marquee announcements (admin)",
        responses: { "200": { description: "Marquees", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Marquee" } } } } } },
      },
      post: {
        tags: ["Marquees"],
        summary: "Create marquee",
        security: adminSecurity,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/marquees/active": {
      get: {
        tags: ["Marquees"],
        summary: "List currently scheduled marquees (public)",
        responses: { "200": { description: "Active marquees" } },
      },
    },
    "/marquees/{id}": {
      get: {
        tags: ["Marquees"],
        summary: "Get marquee by ID",
        parameters: [IdParam],
        responses: { "200": { description: "Marquee" }, "404": ErrorResponse },
      },
      patch: {
        tags: ["Marquees"],
        summary: "Update marquee",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse },
      },
      delete: {
        tags: ["Marquees"],
        summary: "Soft-delete marquee",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // FAQs
    // ═══════════════════════════════════════════════════════
    "/faqs": {
      get: {
        tags: ["FAQs"],
        summary: "List all FAQs",
        responses: { "200": { description: "FAQs", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/FAQ" } } } } } },
      },
      post: {
        tags: ["FAQs"],
        summary: "Create FAQ",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["question", "answer"],
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/faqs/active": {
      get: {
        tags: ["FAQs"],
        summary: "List active FAQs (public — for chatbox)",
        responses: { "200": { description: "Active FAQs" } },
      },
    },
    "/faqs/reorder": {
      put: {
        tags: ["FAQs"],
        summary: "Batch reorder FAQs",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { order: { type: "array", items: { type: "object" } } } },
            },
          },
        },
        responses: { "200": { description: "Reordered FAQs" }, "401": ErrorResponse },
      },
    },
    "/faqs/{id}": {
      patch: {
        tags: ["FAQs"],
        summary: "Update FAQ",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  isActive: { type: "boolean" },
                  displayOrder: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["FAQs"],
        summary: "Delete FAQ (hard delete)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // TIMELINE / EVENTS (public Gigs map on the About page)
    // ═══════════════════════════════════════════════════════
    "/releases": {
      get: {
        tags: ["Releases"],
        summary: "List live releases (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Releases", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Release" } } } } }, "401": ErrorResponse },
      },
      post: {
        tags: ["Releases"],
        summary: "Create a release",
        description:
          "Platform links are validated by lib/embeds.ts (host allow-list) and rejected with 400 when they don't parse. `tracks` is the full tracklist in order; blank titles are dropped. The slug is generated once from the title.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "coverImageUrl"],
                properties: {
                  title: { type: "string" },
                  type: { type: "string", enum: ["SINGLE", "EP", "ALBUM", "LIVE", "COMPILATION"] },
                  coverImageUrl: { type: "string" },
                  releaseDate: { type: "string", format: "date", nullable: true },
                  description: { type: "string", nullable: true },
                  featured: { type: "boolean" },
                  published: { type: "boolean" },
                  spotifyUrl: { type: "string", nullable: true },
                  bandcampUrl: { type: "string", nullable: true },
                  youtubeUrl: { type: "string", nullable: true },
                  soundcloudUrl: { type: "string", nullable: true },
                  appleMusicUrl: { type: "string", nullable: true },
                  primaryPlayer: { type: "string", nullable: true },
                  tracks: { type: "array", items: { type: "object", properties: { title: { type: "string" }, durationSec: { type: "integer", nullable: true }, url: { type: "string", nullable: true }, lyrics: { type: "string", nullable: true } } } },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Release" } } } }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/releases/public": {
      get: {
        tags: ["Releases"],
        summary: "Published releases (public)",
        description: "What /music shows: published, not trashed, newest release date first.",
        responses: { "200": { description: "Releases", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Release" } } } } } },
      },
    },
    "/releases/reorder": {
      put: {
        tags: ["Releases"],
        summary: "Reorder releases",
        security: adminSecurity,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { order: { type: "array", items: { type: "object", properties: { id: { type: "string" }, sortOrder: { type: "integer" } } } } } } } } },
        responses: { "200": { description: "Releases in new order" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/releases/{id}": {
      patch: {
        tags: ["Releases"],
        summary: "Update a release (partial)",
        description: "Any Release field except id/slug. `tracks`, when present, replaces the whole tracklist. Platform link fields accept null to clear.",
        security: adminSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Release" } } } }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Releases"],
        summary: "Move a release to Trash",
        security: adminSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },
    "/videos": {
      get: {
        tags: ["Videos"],
        summary: "List live videos (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Videos", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Video" } } } } }, "401": ErrorResponse },
      },
      post: {
        tags: ["Videos"],
        summary: "Create a video",
        description: "`youtubeUrl` must parse as a YouTube link (400 otherwise); the id is derived server-side. `releaseId` must name a live release.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["title", "youtubeUrl"], properties: { title: { type: "string" }, youtubeUrl: { type: "string" }, kind: { type: "string", enum: ["MUSIC_VIDEO", "LIVE", "BEHIND_THE_SCENES"] }, releaseId: { type: "string", nullable: true }, description: { type: "string", nullable: true }, published: { type: "boolean" }, featured: { type: "boolean" } } } } },
        },
        responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Video" } } } }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/videos/public": {
      get: {
        tags: ["Videos"],
        summary: "Published videos (public)",
        responses: { "200": { description: "Videos, featured first" } },
      },
    },
    "/videos/reorder": {
      put: {
        tags: ["Videos"],
        summary: "Reorder videos",
        security: adminSecurity,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { order: { type: "array", items: { type: "object", properties: { id: { type: "string" }, sortOrder: { type: "integer" } } } } } } } } },
        responses: { "200": { description: "Videos in new order" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/videos/{id}": {
      patch: {
        tags: ["Videos"],
        summary: "Update a video (partial)",
        security: adminSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Video" } } } }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Videos"],
        summary: "Move a video to Trash",
        security: adminSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },
    "/events": {
      get: {
        tags: ["Events"],
        summary: "List all events (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Events", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Event" } } } } }, "401": ErrorResponse },
      },
      post: {
        tags: ["Events"],
        summary: "Create event",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "latitude", "longitude"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  venueName: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  eventDate: { type: "string", format: "date-time" },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/events/public": {
      get: {
        tags: ["Events"],
        summary: "List enabled events (public — Timeline map on /about)",
        responses: { "200": { description: "Public events" } },
      },
    },
    "/events/reorder": {
      put: {
        tags: ["Events"],
        summary: "Batch reorder events",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { order: { type: "array", items: { type: "object" } } } },
            },
          },
        },
        responses: { "200": { description: "Reordered events" }, "401": ErrorResponse },
      },
    },
    "/events/media": {
      post: {
        tags: ["Events"],
        summary: "Attach a media item to an event",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["eventId", "url", "type"],
                properties: {
                  eventId: { type: "string" },
                  url: { type: "string" },
                  type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Attached" }, "400": ErrorResponse, "401": ErrorResponse },
      },
      put: {
        tags: ["Events"],
        summary: "Batch reorder an event's media (drag-to-reorder in the admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { order: { type: "array", items: { type: "object" } } } },
            },
          },
        },
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
      delete: {
        tags: ["Events"],
        summary: "Remove a media item",
        security: adminSecurity,
        parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },
    "/events/{id}": {
      patch: {
        tags: ["Events"],
        summary: "Update event (including toggling isNextEvent)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  venueName: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  eventDate: { type: "string", format: "date-time" },
                  isNextEvent: { type: "boolean" },
                  enabled: { type: "boolean" },
                  displayOrder: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Events"],
        summary: "Soft delete event (moves to Trash)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // DIGITAL MUSEUM
    // ═══════════════════════════════════════════════════════
    "/digital-museum": {
      get: {
        tags: ["Digital Museum"],
        summary: "Get museum config + room list (admin)",
        description:
          "Lazily provisions the About ScriptOverNovel, Freedom Wall, Stairs, Services, Tales, Arcade and Cosplay rooms, and reconciles the mirror rooms' contents (Services → live shop, Stories → published library, Arcade → playable mini games, Cosplay → published cosplays) before responding. `rooms` holds the curated rooms plus the Services, Stories, Arcade and Cosplay rooms (each with a real displayOrder among them); About/Freedom Wall/Stairs are returned as their own top-level ids/visuals instead. Also returns `storiesRoomId`, `arcadeRoomId` and `cosplayRoomId` for direct addressing.",
        security: adminSecurity,
        responses: { "200": { description: "Museum configuration and rooms" }, "401": ErrorResponse },
      },
      patch: {
        tags: ["Digital Museum"],
        summary: "Update museum-wide settings",
        security: adminSecurity,
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  title: { type: "string" },
                  description: { type: "string" },
                  splashEnabled: { type: "boolean" },
                  splashEffect: { type: "string", enum: ["fade", "slide-up", "slide-down", "portrait-half", "landscape-half"] },
                  splashSpeedMs: { type: "integer" },
                  splashBgColor: { type: "string" },
                  achievementsEnabled: { type: "boolean" },
                  achievementsHudEnabled: { type: "boolean" },
                  museumMusicUrl: { type: "string" },
                  museumMusicEnabled: { type: "boolean" },
                  museumMusicVolume: { type: "integer" },
                  museumBrightnessLight: { type: "integer" },
                  museumBrightnessDark: { type: "integer" },
                  artworkShimmerConfig: {
                    type: "object",
                    nullable: true,
                    description:
                      "The light sweep across an artwork the visitor has walked up to, museum-wide. Sent as an object and stored as JSON; null restores the defaults (on). See lib/museum/artworkShimmer.ts.",
                    properties: {
                      enabled: { type: "boolean" },
                      speed: { type: "number", description: "Sweeps per second (0.1–3)." },
                      strength: { type: "number", description: "0–1." },
                      color: { type: "string", description: "Hex tint of the band." },
                      bandWidth: { type: "number", description: "Band width as a fraction of the artwork (0.04–0.4)." },
                    },
                  },
                  museumBrightnessDim: { type: "integer", description: "0–100 brightness for the third visitor lighting mode, Dim ([L] cycles Light → Dim → Dark). Light mode's colour presets at this brightness." },
                  visionFiltersEnabled: {
                    type: "boolean",
                    description:
                      "Master switch for Filter Vision — the visitor-selectable look filters cycled with [Q] or the HUD button. Off removes the key handler and the button entirely rather than leaving a control that cycles between Normal and Normal.",
                  },
                  visionFilterConfig: {
                    type: "object",
                    nullable: true,
                    description:
                      "Which look filters visitors can cycle. Sent as an object and stored as JSON; null resets to all five built-ins and no custom ones. `enabledBuiltIns` is a list of built-in ids (noir, sepia, night-vision, infrared, dreamscape) — unrecognised ids are dropped rather than rejected. `custom` holds up to 5 admin-mixed looks, each { id, label, color (6-digit hex), intensity 0–2, brightness 0.5–1.6 }; out-of-range numbers are clamped and a bad hex falls back to the default colour.",
                    properties: {
                      enabledBuiltIns: { type: "array", items: { type: "string" } },
                      custom: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            label: { type: "string" },
                            color: { type: "string" },
                            intensity: { type: "number" },
                            brightness: { type: "number" },
                          },
                        },
                      },
                    },
                  },
                  minimapConfig: {
                    type: "object",
                    nullable: true,
                    description:
                      "Look of the museum's bottom-left radar card, museum-wide. Sent as an object and stored as JSON; every field is optional and defaults to the look the HUD ships with, so null clears it back to that. `width`/`height` size the map canvas in CSS pixels (desktop; phones keep their own smaller map), `counterScale` sizes the counter row as a percentage, the seven `*Color` fields are 6-digit hex (player pointer, artwork dots, object dots, the nearby glow, companion dots, the room outline and its doorways), and `stepsIcon`/`viewsIcon`/`timeIcon`/`wishlistIcon` each name one of a fixed icon set. The `floorLabel*` fields style the floor name painted on the map: `floorLabelEnabled` shows/hides it, `floorLabelGround`/`floorLabelUpper`/`floorLabelStairs` are the texts for floor 0, floor 1 and the STAIRS connector (≤32 chars, blank falls back to the default), `floorLabelFont` is one of the site theme's font-family values, `floorLabelStyle` is normal|bold|italic|bold-italic, `floorLabelSize` is 8–24 px, `floorLabelColor` is 6-digit hex, `floorLabelPosition` is top-left|top-center|top-right|bottom-left|bottom-center|bottom-right, and `floorLabelUppercase` draws it in tracked capitals. Out-of-range sizes are clamped and unrecognised colours, fonts, styles, positions or icon names fall back to the default rather than being rejected.",
                    properties: {
                      width: { type: "integer" },
                      height: { type: "integer" },
                      counterScale: { type: "integer" },
                      playerColor: { type: "string" },
                      artworkColor: { type: "string" },
                      objectColor: { type: "string" },
                      activeColor: { type: "string" },
                      companionColor: { type: "string" },
                      roomColor: { type: "string" },
                      doorColor: { type: "string" },
                      stepsIcon: { type: "string" },
                      viewsIcon: { type: "string" },
                      timeIcon: { type: "string" },
                      wishlistIcon: { type: "string" },
                      floorLabelEnabled: { type: "boolean" },
                      floorLabelGround: { type: "string" },
                      floorLabelUpper: { type: "string" },
                      floorLabelStairs: { type: "string" },
                      floorLabelFont: { type: "string" },
                      floorLabelStyle: {
                        type: "string",
                        enum: ["normal", "bold", "italic", "bold-italic"],
                      },
                      floorLabelSize: { type: "integer" },
                      floorLabelSpacing: { type: "integer", description: "Pixels of room around the floor label — card edge on one side, room outline on the other (0–40, default 5)." },
                      floorLabelColor: { type: "string" },
                      floorLabelPosition: {
                        type: "string",
                        enum: [
                          "top-left",
                          "top-center",
                          "top-right",
                          "bottom-left",
                          "bottom-center",
                          "bottom-right",
                        ],
                      },
                      floorLabelUppercase: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated config" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/digital-museum/preview-about": {
      get: {
        tags: ["Digital Museum"],
        summary: "Get About ScriptOverNovel room content for admin preview (admin)",
        description: "Returns MuseumAboutData so the Museum Preview sidebar can render the About room's 3D contents without importing Prisma into a client component.",
        security: adminSecurity,
        responses: { "200": { description: "About room content data" }, "401": ErrorResponse, "500": ErrorResponse },
      },
    },
    "/digital-museum/rooms": {
      get: {
        tags: ["Digital Museum"],
        summary: "List museum rooms (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Rooms", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/MuseumRoom" } } } } }, "401": ErrorResponse },
      },
      post: {
        tags: ["Digital Museum"],
        summary: "Create museum room",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  roomType: { type: "string", enum: ["MAIN_HALL", "GALLERY", "SPECIAL_EXHIBITION"] },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created room" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/digital-museum/rooms/reorder": {
      put: {
        tags: ["Digital Museum"],
        summary: "Batch reorder museum rooms",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { order: { type: "array", items: { type: "object" } } } },
            },
          },
        },
        responses: { "200": { description: "Updated rooms" }, "401": ErrorResponse },
      },
    },
    "/digital-museum/rooms/{id}": {
      get: {
        tags: ["Digital Museum"],
        summary: "Get room with linked artworks (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": { description: "Room" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      patch: {
        tags: ["Digital Museum"],
        summary: "Update room settings",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  roomType: { type: "string", enum: ["MAIN_HALL", "GALLERY", "SPECIAL_EXHIBITION"], description: "Only these three are accepted — the provisioned ABOUT/FREEDOM_WALL/STAIRS/SERVICES markers can't be assigned or changed here." },
                  enabled: { type: "boolean" },
                  isEntryRoom: { type: "boolean" },
                  floor: { type: "integer", enum: [0, 1], description: "0 = ground floor, 1 = second floor. Rejected (409) if it would leave the entry/spawn room on the Second Floor — see docs/SecondFloorStairs_Spec.md." },
                  wallColor: { type: "string" },
                  floorColor: { type: "string" },
                  ceilingColor: { type: "string" },
                  wallTexture: { type: "string" },
                  floorTexture: { type: "string" },
                  ceilingTexture: { type: "string" },
                  lightColor: { type: "string", nullable: true, description: "Hex colour for the room's ceiling lights in every mode, or null/\"\" to go back to the roomType preset's colour." },
                  lightScale: { type: "number", description: "Size multiplier for the fixture drawn at each ceiling light (clamped 0.25–4, 1 = as designed)." },
                  lightModelUrl: { type: "string", nullable: true, description: ".glb URL (from the signed model upload) drawn at each ceiling light in place of the built-in fixture, or null/\"\" for the built-in one." },
                  splashIcon: { type: "string" },
                  splashTitle: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated room" }, "401": ErrorResponse, "404": ErrorResponse, "409": ErrorResponse },
      },
      delete: {
        tags: ["Digital Museum"],
        summary: "Soft-delete room",
        description:
          "409 when the room is the only enabled one, or when it's the Services Room (provisioned, never deleted — disable it with `enabled: false` instead).",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "409": ErrorResponse },
      },
    },
    "/digital-museum/rooms/{id}/artworks": {
      post: {
        tags: ["Digital Museum"],
        summary: "Add artwork to room",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["artworkId"], properties: { artworkId: { type: "string" } } } } },
        },
        responses: { "201": { description: "Added" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Digital Museum"],
        summary: "Remove artwork from room",
        security: adminSecurity,
        parameters: [
          IdParam,
          { name: "artworkId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },
    "/digital-museum/rooms/{id}/artworks/reorder": {
      put: {
        tags: ["Digital Museum"],
        summary: "Reorder artworks in room",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { order: { type: "array", items: { type: "object" } } } } } },
        },
        responses: { "200": { description: "Reordered artworks" }, "401": ErrorResponse },
      },
    },
    "/digital-museum/rooms/{id}/scene-objects": {
      get: {
        tags: ["Digital Museum"],
        summary: "List scene objects in room (auto-provisions About room blocks and Contact Desk, plus the wall clock in the About room and the visitor's respawn room)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": { description: "Scene objects" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      post: {
        tags: ["Digital Museum"],
        summary: "Add a scene object to a room (custom .glb prop, text label, or divider wall)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  kind: {
                    type: "string",
                    enum: ["custom", "text", "divider"],
                    description:
                      "What to add; defaults to \"custom\". \"custom\" is an uploaded .glb prop and requires modelUrl. \"text\" and \"divider\" need no upload — each is created with default config JSON in modelUrl that the Scene Editor then edits.",
                  },
                  modelUrl: {
                    type: "string",
                    description:
                      "Required for kind \"custom\" (the uploaded .glb URL). For \"text\" and \"divider\" this carries that kind's config JSON instead, and is generated from defaults when omitted.",
                  },
                  label: { type: "string", description: "Optional display name for a custom .glb prop (max 80 chars); ignored for other kinds" },
                  positionX: { type: "number" },
                  positionY: { type: "number" },
                  positionZ: { type: "number" },
                  rotationY: { type: "number" },
                  scale: { type: "number", description: "Uniform scale for a custom .glb prop; defaults to 1" },
                  solid: { type: "boolean", description: "Custom .glb prop: block the player from walking through it; defaults to false" },
                  colliderRadius: { type: "number", nullable: true, description: "Custom .glb prop collision footprint in the model's own units (before scale); null = auto-fit" },
                  colliderOffsetX: { type: "number", description: "Where that footprint sits, sideways from the model's own origin (model units, before scale; the prop's own rotated frame). Defaults to 0 = centred on the origin" },
                  colliderOffsetZ: { type: "number", description: "Where that footprint sits, front-to-back from the model's own origin (model units, before scale; the prop's own rotated frame). Defaults to 0 = centred on the origin" },
                  colliderHeight: { type: "number", nullable: true, description: "How tall that footprint stands, measured up from the prop's own base (model units, before scale). Null = a floor-to-ceiling column, the default and the behaviour before this existed; set it and visitors can walk under or jump over the prop" },
                  colliderBaseY: { type: "number", description: "How far that column is lifted off the prop's own base (model units, before scale). 0 (the default) stands it on the base. Only meaningful alongside colliderHeight — with no height there is no column to lift, only the floor-to-ceiling default. This is what lets an archway crossbeam or a shelf be solid where it is and open underneath" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Added object" }, "400": ErrorResponse, "401": ErrorResponse, "409": ErrorResponse },
      },
    },
    "/digital-museum/room-artworks/{id}": {
      patch: {
        tags: ["Digital Museum"],
        summary: "Update artwork frame position/scale in scene",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  positionX: { type: "number", nullable: true },
                  positionY: { type: "number", nullable: true },
                  positionZ: { type: "number", nullable: true },
                  rotationY: { type: "number", nullable: true },
                  scale: { type: "number", nullable: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/digital-museum/room-stories/{id}": {
      patch: {
        tags: ["Digital Museum"],
        summary: "Update tale podium position/scale in scene",
        description:
          "[id] is the MuseumRoomStory join row's id. Position is all-or-nothing: send all four fields as numbers (a custom placement) or all four as null (reset to podiumPlacement.ts's auto floor grid). Only the Stories Room has these rows, and membership is mirrored from the published library — this endpoint only ever moves a podium, never adds or removes one.",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  positionX: { type: "number", nullable: true },
                  positionY: {
                    type: "number",
                    nullable: true,
                    description: "Raise off the room's own floor; 0 normally (unlike a wall frame's world height)",
                  },
                  positionZ: { type: "number", nullable: true },
                  rotationY: { type: "number", nullable: true },
                  scale: { type: "number", nullable: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/digital-museum/room-cosplays/{id}": {
      patch: {
        tags: ["Digital Museum"],
        summary: "Update cosplay standee position/scale/lights in scene",
        description:
          "[id] is the MuseumRoomCosplay join row's id. Position is all-or-nothing: send all four fields as numbers (a custom placement) or all four as null (reset to standeePlacement.ts's auto wall slot). One placement moves the whole pair \u2014 the standee and the photo hung behind it \u2014 so there is no separate endpoint for the backdrop. `lightsEnabled` is this standee's own billboard-lights switch \u2014 the one cosplay-room setting that is per-standee rather than room-wide \u2014 and can be sent alone or alongside a placement update. Only the Cosplay Room has these rows, and membership is mirrored from the published Cosplays: this endpoint only ever moves/relights a standee, never adds or removes one.",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  positionX: { type: "number", nullable: true },
                  positionY: {
                    type: "number",
                    nullable: true,
                    description: "Raise off the room's own floor; 0 normally",
                  },
                  positionZ: { type: "number", nullable: true },
                  rotationY: { type: "number", nullable: true },
                  scale: { type: "number", nullable: true },
                  lightsEnabled: {
                    type: "boolean",
                    description: "This standee's own billboard-lights switch. How lit bulbs look is room-wide (see the Cosplay Room's standee-config scene object).",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/digital-museum/room-minigames/{id}": {
      patch: {
        tags: ["Digital Museum"],
        summary: "Update arcade cabinet position/scale/display mode in scene",
        description:
          "[id] is the MuseumRoomMiniGame join row's id. Position is all-or-nothing: send all four fields as numbers (a custom placement) or all four as null (reset to cabinetPlacement.ts's auto floor grid). `displayMode` flips one game between a floor cabinet and a wall poster, or null to inherit the room-wide default (see the arcade-config scene object). Only the Arcade Room has these rows, and membership is mirrored from the playable mini games — this endpoint only ever moves/restyles a cabinet, never adds or removes one.",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  positionX: { type: "number", nullable: true },
                  positionY: {
                    type: "number",
                    nullable: true,
                    description: "Raise off the room's own floor; 0 normally",
                  },
                  positionZ: { type: "number", nullable: true },
                  rotationY: { type: "number", nullable: true },
                  scale: { type: "number", nullable: true },
                  displayMode: {
                    type: "string",
                    nullable: true,
                    enum: ["CABINET", "POSTER"],
                    description: "null inherits the room-wide default",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/digital-museum/scene-objects/{id}": {
      patch: {
        tags: ["Digital Museum"],
        summary: "Update scene object position or restore soft-deleted one",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  positionX: { type: "number" },
                  positionY: { type: "number" },
                  positionZ: { type: "number" },
                  rotationY: { type: "number" },
                  scale: { type: "number", description: "Uniform scale for a custom .glb prop (1 = exported size)" },
                  label: { type: "string", nullable: true, description: "Display name for a custom .glb prop; null clears it back to the generic label" },
                  solid: { type: "boolean", description: "Custom .glb prop: block the player from walking through it" },
                  colliderRadius: { type: "number", nullable: true, description: "Custom .glb prop collision footprint (model units, before scale); null = auto-fit" },
                  colliderOffsetX: { type: "number", description: "Where that footprint sits, sideways from the model's own origin (model units, before scale; the prop's own rotated frame). Defaults to 0 = centred on the origin" },
                  colliderOffsetZ: { type: "number", description: "Where that footprint sits, front-to-back from the model's own origin (model units, before scale; the prop's own rotated frame). Defaults to 0 = centred on the origin" },
                  colliderHeight: { type: "number", nullable: true, description: "How tall that footprint stands, measured up from the prop's own base (model units, before scale). Null = a floor-to-ceiling column, the default and the behaviour before this existed; set it and visitors can walk under or jump over the prop" },
                  colliderBaseY: { type: "number", description: "How far that column is lifted off the prop's own base (model units, before scale). 0 (the default) stands it on the base. Only meaningful alongside colliderHeight — with no height there is no column to lift, only the floor-to-ceiling default. This is what lets an archway crossbeam or a shelf be solid where it is and open underneath" },
                  modelUrl: {
                    type: "string",
                    nullable: true,
                    description:
                      "For a custom .glb prop, the model URL. For a divider wall (kind `divider`) it carries that panel's config JSON — width/height/thickness in metres, colour, an optional tiled surface texture and whether it is mirrored, and whether visitors are blocked by it. For the kind-marked config singletons this column carries JSON instead: the About plaque/label config, the Stories Room's `story-podium-model` (uploaded pedestal .glb, its tiled texture and book height), the Arcade Room's `arcade-config` (room-wide CABINET/POSTER default, plus the cabinet .glb or tiled texture and the screen height/depth the game screen and marquee are drawn at), the About room's `about-contact` (the Contact Desk's optional .glb or tiled texture, plus the title/subtitle on the Send an Email panel it opens and the words on its walk-up prompt), and `room-banner` — provisioned once for each of the Stories/Arcade/Services/About/Cosplay rooms, holding the one plaque style every label that room draws reads from (panel/edge/text colours, edge width, font and text scale, an optional stretched panel texture, panel brightness, and a frosted-glass mode with its own opacity plus an optional shimmer sweep and its speed/strength).",
                  },
                  hidden: {
                    type: "boolean",
                    description:
                      "Keep this object out of the public museum while leaving the row — its model, config and placement — untouched. Distinct from a DELETE: the provisioned fixtures (About room blocks, Contact Desk, Digital Wall Clock, Freedom Wall plaque) are re-created by code whenever they are missing, so deleting one only resets it; this is the switch that actually removes it from what visitors see, and it reverses cleanly.",
                  },
                  restore: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated" },
          "401": ErrorResponse,
          "404": ErrorResponse,
          "409": {
            ...ErrorResponse,
            description:
              "The object has been removed from the room (soft-deleted). Only `restore: true` is accepted for such a row — reload the scene to pick up whatever replaced it.",
          },
        },
      },
      delete: {
        tags: ["Digital Museum"],
        summary: "Soft-delete scene object",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse },
      },
    },
    "/digital-museum/achievements": {
      get: {
        tags: ["Digital Museum"],
        summary: "List all achievements (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Achievements", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/MuseumAchievement" } } } } }, "401": ErrorResponse },
      },
      post: {
        tags: ["Digital Museum"],
        summary: "Create achievement",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["category", "threshold", "reward"],
                properties: {
                  category: { type: "string", enum: ["time", "views", "wishlist", "steps"] },
                  threshold: { type: "integer", minimum: 1 },
                  reward: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse, "409": ErrorResponse },
      },
    },
    "/digital-museum/achievements/active": {
      get: {
        tags: ["Digital Museum"],
        summary: "List enabled achievements (public — museum client)",
        responses: { "200": { description: "Active achievements" } },
      },
    },
    "/digital-museum/achievements/{id}": {
      patch: {
        tags: ["Digital Museum"],
        summary: "Update achievement",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  threshold: { type: "integer" },
                  reward: { type: "string" },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Digital Museum"],
        summary: "Delete achievement (hard delete, cascades claims)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/digital-museum/achievements/{id}/claim": {
      post: {
        tags: ["Digital Museum"],
        summary: "Claim museum achievement reward (public)",
        description: "Rate limited. Self-reported eligibility. One claim per email per achievement.",
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  reportedValue: { type: "number" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Claimed" }, "400": ErrorResponse, "404": ErrorResponse, "409": ErrorResponse, "429": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // MINI GAMES
    // ═══════════════════════════════════════════════════════
    "/minigames": {
      get: {
        tags: ["Mini Games"],
        summary: "Get available games for the public selector",
        responses: { "200": { description: "Public game list" } },
      },
    },
    "/minigames/config": {
      get: {
        tags: ["Mini Games"],
        summary: "Get all games with admin config (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Admin game configs" }, "401": ErrorResponse },
      },
      put: {
        tags: ["Mini Games"],
        summary: "Save one game's configuration (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type"],
                properties: {
                  type: { type: "string" },
                  enabled: { type: "boolean" },
                  difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
                  artworkId: { type: "string" },
                  timeLimitSec: { type: "integer" },
                  leaderboardEnabled: { type: "boolean" },
                  rewardEnabled: { type: "boolean" },
                  rewardThreshold: { type: "integer" },
                  rewardDescription: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/minigames/session": {
      post: {
        tags: ["Mini Games"],
        summary: "Start a game round",
        description: "Rate limited. Server generates the puzzle and returns it with a session ID.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["type"], properties: { type: { type: "string" } } } } },
        },
        responses: { "201": { description: "Session created with challenge payload" }, "400": ErrorResponse, "409": ErrorResponse, "429": ErrorResponse },
      },
    },
    "/minigames/submit": {
      post: {
        tags: ["Mini Games"],
        summary: "Submit game result (moves log)",
        description: "Server verifies moves against its stored challenge. Score never comes from client.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId", "moves"],
                properties: {
                  sessionId: { type: "string" },
                  moves: { type: "object", description: "Move log specific to the game type" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Submit result with score, rank, leaderboard" }, "400": ErrorResponse, "404": ErrorResponse, "409": ErrorResponse, "410": ErrorResponse, "422": ErrorResponse, "429": ErrorResponse },
      },
    },
    "/minigames/leaderboard": {
      get: {
        tags: ["Mini Games"],
        summary: "Get public leaderboard for a game",
        parameters: [
          { name: "type", in: "query", required: true, schema: { type: "string" } },
          { name: "artworkId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Leaderboard entries" }, "400": ErrorResponse },
      },
      post: {
        tags: ["Mini Games"],
        summary: "Submit display name to leaderboard after a completed round",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId", "displayName"],
                properties: {
                  sessionId: { type: "string" },
                  displayName: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Rank and updated leaderboard" }, "400": ErrorResponse, "409": ErrorResponse },
      },
      delete: {
        tags: ["Mini Games"],
        summary: "Reset leaderboard for a game (admin)",
        security: adminSecurity,
        parameters: [{ name: "type", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Deleted count" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/minigames/leaderboard/{id}": {
      delete: {
        tags: ["Mini Games"],
        summary: "Delete single leaderboard entry (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/minigames/entries": {
      get: {
        tags: ["Mini Games"],
        summary: "Admin leaderboard moderation table with reward claim join",
        security: adminSecurity,
        parameters: [
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "artworkId", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Paginated leaderboard rows" }, "401": ErrorResponse },
      },
    },
    "/minigames/reward": {
      post: {
        tags: ["Mini Games"],
        summary: "Claim game reward",
        description: "Server re-verifies eligibility from stored session score.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId", "email"],
                properties: {
                  sessionId: { type: "string" },
                  email: { type: "string", format: "email" },
                  displayName: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Reward claimed" }, "400": ErrorResponse, "404": ErrorResponse, "409": ErrorResponse, "429": ErrorResponse },
      },
    },
    "/minigames/claims": {
      get: {
        tags: ["Mini Games"],
        summary: "List reward claims (admin, includes email)",
        security: adminSecurity,
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "FULFILLED", "REJECTED"] } },
          { name: "type", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Reward claims" }, "401": ErrorResponse },
      },
    },
    "/minigames/claims/{id}": {
      patch: {
        tags: ["Mini Games"],
        summary: "Update claim status (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: { status: { type: "string", enum: ["PENDING", "FULFILLED", "REJECTED"] } },
              },
            },
          },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // FREEDOM WALL
    // ═══════════════════════════════════════════════════════
    "/freedom-wall/room-status": {
      get: {
        tags: ["Freedom Wall"],
        summary: "Get room active status and current event (public)",
        responses: { "200": { description: "Room status" } },
      },
    },
    "/freedom-wall/notes": {
      get: {
        tags: ["Freedom Wall"],
        summary: "Get non-archived notes for the active event (public)",
        responses: { "200": { description: "Notes" } },
      },
      post: {
        tags: ["Freedom Wall"],
        summary: "Post a note to the active event (public, reCAPTCHA protected)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  nickname: { type: "string" },
                  content: { type: "string" },
                  captchaToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Note created" }, "400": ErrorResponse, "403": ErrorResponse },
      },
    },
    "/admin/freedom-wall/room-toggle": {
      patch: {
        tags: ["Freedom Wall"],
        summary: "Toggle Freedom Wall active state or set active event (admin)",
        security: adminSecurity,
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  isActive: { type: "boolean" },
                  activeEventId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse },
      },
    },
    "/admin/freedom-wall/events": {
      get: {
        tags: ["Freedom Wall"],
        summary: "List all events (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Events and current settings" }, "401": ErrorResponse },
      },
      post: {
        tags: ["Freedom Wall"],
        summary: "Create event folder (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["title"], properties: { title: { type: "string" } } } } },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/admin/freedom-wall/events/{id}": {
      patch: {
        tags: ["Freedom Wall"],
        summary: "Rename, archive, or activate an event (admin)",
        description:
          "Exactly one operation per call, resolved in this order: `title` renames the event " +
          "(1-120 chars; the active event's name is painted on the museum's Freedom Wall), " +
          "`setActive: true` makes it the event new notes land in, `isArchived` archives or " +
          "restores it (archiving the active event also clears activeEventId).",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", minLength: 1, maxLength: 120 },
                  setActive: { type: "boolean", enum: [true] },
                  isArchived: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Freedom Wall"],
        summary: "Move an event to Trash (admin)",
        description:
          "Soft delete — the event and every sticky note it holds leave the admin panel and " +
          "the public wall and show up under Trash → Freedom Wall → Events, restorable as a " +
          "unit. If it was the active event, activeEventId is cleared. The permanent delete " +
          "is DELETE /trash/freedom-wall-events/{id}.",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": { description: "Moved to Trash" }, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/admin/freedom-wall/events/{id}/notes": {
      get: {
        tags: ["Freedom Wall"],
        summary: "List notes for a specific event (admin)",
        description: "Includes archived notes, but never trashed ones — those live in /trash.",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": { description: "Notes" }, "401": ErrorResponse },
      },
      delete: {
        tags: ["Freedom Wall"],
        summary: "Move every note under an event to Trash (admin)",
        description:
          "Soft delete — the notes leave the public wall immediately and show up under " +
          "Trash → Freedom Wall, where they can be viewed, restored or purged individually.",
        security: adminSecurity,
        parameters: [IdParam],
        responses: {
          "200": {
            description: "Number of notes moved to Trash",
            content: { "application/json": { schema: { type: "object", properties: { deleted: { type: "integer" } } } } },
          },
          "401": ErrorResponse,
        },
      },
    },
    "/admin/freedom-wall/notes/{id}": {
      patch: {
        tags: ["Freedom Wall"],
        summary: "Archive/unarchive a note, and/or save its Scene Editor placement (admin)",
        description:
          "Any of isArchived, positionX/positionY (0-100, wall percentage), scale (0.5-2.5) and " +
          "wall (north|south|east|west) may be included; only the fields present are updated. " +
          "positionX/positionY/scale/wall are written by the Museum Scene Editor's drag/pick-and-Save " +
          "flow (EditableStickyNote).",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  isArchived: { type: "boolean" },
                  positionX: { type: "number", minimum: 0, maximum: 100 },
                  positionY: { type: "number", minimum: 0, maximum: 100 },
                  scale: { type: "number", minimum: 0.5, maximum: 2.5 },
                  wall: { type: "string", enum: ["north", "south", "east", "west"] },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Freedom Wall"],
        summary: "Move a note to Trash (admin)",
        description:
          "Soft delete. The permanent delete is DELETE /trash/freedom-wall-notes/{id}.",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "204": { description: "Moved to Trash" }, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    // ═══════════════════════════════════════════════════════
    // VISITOR COUNT & MILESTONES
    // ═══════════════════════════════════════════════════════
    "/visitor-count": {
      get: {
        tags: ["Visitor"],
        summary: "Get current visitor count and achieved milestones (public read-only)",
        responses: { "200": { description: "Count and achieved milestones" } },
      },
      post: {
        tags: ["Visitor"],
        summary: "Register visit (public, rate-limited per IP, once per browser cookie)",
        responses: { "200": { description: "Count and achieved milestones" }, "429": ErrorResponse },
      },
      patch: {
        tags: ["Visitor"],
        summary: "Recalibrate visitor count (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["count"], properties: { count: { type: "integer" } } } } },
        },
        responses: { "200": { description: "Updated count" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/release-notes": {
      get: {
        tags: ["Release Notes"],
        summary: "List every release note including drafts (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Notes, newest first" }, "401": ErrorResponse, "500": ErrorResponse },
      },
      post: {
        tags: ["Release Notes"],
        summary: "Create a release note",
        description:
          "`publishedAt` defaults to now when omitted. `isPublished` defaults to true \u2014 " +
          "a published note appears in the navbar panel immediately, subject to the newest-N cap " +
          "in Profile.releaseNotesLimit.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "body"],
                properties: {
                  title: { type: "string", maxLength: 120 },
                  body: { type: "string", maxLength: 2000 },
                  category: { type: "string", example: "Digital Museum" },
                  version: { type: "string", nullable: true, example: "v6.15" },
                  isPublished: { type: "boolean" },
                  publishedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse, "500": ErrorResponse },
      },
    },
    "/release-notes/{id}": {
      patch: {
        tags: ["Release Notes"],
        summary: "Update a release note, or flip it between published and draft (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", maxLength: 120 },
                  body: { type: "string", maxLength: 2000 },
                  category: { type: "string" },
                  version: { type: "string", nullable: true },
                  isPublished: { type: "boolean" },
                  publishedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Release Notes"],
        summary: "Move a release note to Trash (admin, soft delete)",
        description:
          "Sets deletedAt, so the note leaves the admin list and the public panel and shows up in the Trash module under Release Notes, where it can be restored or destroyed for good. It was a hard delete until release notes became trashable.",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/release-notes/active": {
      get: {
        tags: ["Release Notes"],
        summary: "Newest published release notes for the navbar panel (public)",
        description:
          "Drafts are never returned, and the row cap is applied server-side from " +
          "Profile.releaseNotesLimit \u2014 the response cannot be widened from the client. " +
          "Returns `enabled: false` with an empty list when the panel is switched off in Settings.",
        responses: {
          "200": {
            description: "Panel state and the notes to show",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                    notes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          title: { type: "string" },
                          body: { type: "string" },
                          category: { type: "string" },
                          version: { type: "string", nullable: true },
                          publishedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/visitor-milestones": {
      get: {
        tags: ["Visitor"],
        summary: "List all milestones with live count (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Count and milestones" }, "401": ErrorResponse },
      },
      post: {
        tags: ["Visitor"],
        summary: "Create visitor milestone",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["threshold", "reward"],
                properties: { threshold: { type: "integer" }, reward: { type: "string" } },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse, "409": ErrorResponse },
      },
    },
    "/visitor-milestones/{id}": {
      patch: {
        tags: ["Visitor"],
        summary: "Update milestone (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { threshold: { type: "integer" }, reward: { type: "string" }, enabled: { type: "boolean" } },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Visitor"],
        summary: "Delete milestone (admin, hard delete)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/visitor-milestones/{id}/claim": {
      post: {
        tags: ["Visitor"],
        summary: "Claim milestone reward by email (public)",
        description: "Rate-limited. One claim per email per milestone (DB unique constraint).",
        parameters: [IdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } },
        },
        responses: { "201": { description: "Claimed" }, "400": ErrorResponse, "404": ErrorResponse, "409": ErrorResponse, "429": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // CHASE COMPANIONS
    // ═══════════════════════════════════════════════════════
    "/chase-companions": {
      get: {
        tags: ["Chase Companions"],
        summary: "List all companions (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Companions" }, "401": ErrorResponse },
      },
      post: {
        tags: ["Chase Companions"],
        summary: "Create companion (admin, max 5)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["assetType", "assetUrl"],
                properties: {
                  assetType: { type: "string", enum: ["model", "image"] },
                  assetUrl: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": ErrorResponse, "401": ErrorResponse, "409": ErrorResponse },
      },
    },
    "/chase-companions/active": {
      get: {
        tags: ["Chase Companions"],
        summary: "List enabled companions (public)",
        responses: { "200": { description: "Active companions" } },
      },
    },
    "/chase-companions/{id}": {
      patch: {
        tags: ["Chase Companions"],
        summary: "Toggle enabled or replace asset (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { enabled: { type: "boolean" }, assetType: { type: "string" }, assetUrl: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Chase Companions"],
        summary: "Delete companion (admin, hard delete)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // CERTIFICATES
    // ═══════════════════════════════════════════════════════
    "/certificates": {
      get: {
        tags: ["Artist Profile"],
        summary: "List certificates (public)",
        responses: { "200": { description: "Certificates", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Certificate" } } } } } },
      },
      post: {
        tags: ["Artist Profile"],
        summary: "Create certificate (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  issuer: { type: "string" },
                  dateAwarded: { type: "string", format: "date-time" },
                  description: { type: "string" },
                  imageUrl: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "401": ErrorResponse },
      },
    },
    "/certificates/{id}": {
      patch: {
        tags: ["Artist Profile"],
        summary: "Update certificate (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Updated" }, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Artist Profile"],
        summary: "Delete certificate (admin, also removes image from storage)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ARTIST PROFILE
    // ═══════════════════════════════════════════════════════
    "/profile": {
      get: {
        tags: ["Artist Profile"],
        summary: "Get site profile (public)",
        responses: { "200": { description: "Profile object" } },
      },
      put: {
        tags: ["Artist Profile"],
        summary: "Update profile (admin, upserts the single profile row)",
        security: adminSecurity,
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  bio: { type: "string" },
                  displayName: { type: "string" },
                  headline: { type: "string" },
                  profileImage: { type: "string" },
                  backgroundImage: { type: "string" },
                  logoImage: { type: "string" },
                  basedIn: { type: "string" },
                  experience: { type: "string" },
                  languages: { type: "string" },
                  instagram: { type: "string" },
                  facebook: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  maintenanceMode: { type: "boolean" },
                  musicUrl: { type: "string" },
                  musicEnabled: { type: "boolean" },
                  musicVolume: { type: "integer" },
                  carouselMode: { type: "string" },
                  hoverShimmer: {
                    type: "object",
                    description:
                      "The hover light-sweep on the three public grids, keyed by surface (gallery / stories / shop). Each surface takes a hex color, a speed in seconds per sweep (0.5–6) and a brightness 0–100 (the band's peak opacity; 0 turns that grid's sweep off). Validated field-by-field — an invalid or missing surface falls back to that surface's default rather than rejecting the save. See lib/hover-shimmer.ts.",
                    properties: {
                      gallery: { $ref: "#/components/schemas/ShimmerSettings" },
                      stories: { $ref: "#/components/schemas/ShimmerSettings" },
                      shop: { $ref: "#/components/schemas/ShimmerSettings" },
                    },
                  },
                  introEnabled: { type: "boolean" },
                  introEffect: { type: "string" },
                  introSpeedMs: { type: "integer" },
                  introBgColor: { type: "string", description: "Hex color." },
                  introText: {
                    type: "string",
                    description: "Tagline under the logo. Blank falls back to the default copy.",
                  },
                  introTextAbove: {
                    type: "string",
                    description:
                      "Optional tagline above the logo. Blank stays blank — that is how it is switched off.",
                  },
                  introTaglineFontFamily: {
                    type: "string",
                    description:
                      "Font for the tagline below the logo. One of lib/theme.ts's THEME_FONT_OPTIONS.",
                  },
                  introTaglineFontSize: { type: "string", description: "CSS length, e.g. \"0.75rem\"." },
                  introTaglineColor: { type: "string", description: "Hex color." },
                  introTaglineAboveFontSize: { type: "string", description: "CSS length." },
                  introTaglineFontSizeMobile: { type: "string", nullable: true, description: "Phone-only override for introTaglineFontSize (CSS length). Null clears the override, so phones follow the desktop size — that is the default and what every splash did before this existed. The switch happens in CSS at 640px, not server-side." },
                  introTaglineAboveFontSizeMobile: { type: "string", nullable: true, description: "Phone-only override for introTaglineAboveFontSize. Same null semantics as above." },
                  introTaglineAboveFontFamily: {
                    type: "string",
                    description:
                      "Font for the tagline above the logo, set independently of the one below.",
                  },
                  introTaglineAboveColor: { type: "string", description: "Hex color." },
                  introGlowIntensity: {
                    type: "integer",
                    description:
                      "0-100. Alpha of the radial glow behind the logo; 0 renders no glow layer.",
                  },
                  introGlowColor: { type: "string", description: "Hex color." },
                  introSquidColor: {
                    type: "string",
                    description:
                      "Hex color of the icon seal above the band wordmark on the entrance splash. Tints its halo too. Splash only — the footer/sidebar icons keep their own brand-palette cycle.",
                  },
                  introGlowShimmer: {
                    type: "boolean",
                    description: "Breathes the glow in and out. Respects Reduce Motion.",
                  },
                  introGlowOffsetX: {
                    type: "integer",
                    description:
                      "-50 to 50. Moves the glow's centre horizontally, as a percentage of the lockup's box. 0 is centred.",
                  },
                  introGlowOffsetY: {
                    type: "integer",
                    description:
                      "-50 to 50. Moves the glow's centre vertically, as a percentage of the lockup's box. 0 is centred.",
                  },
                  introLetterColors: {
                    type: "string",
                    enum: ["hover", "always"],
                    description:
                      "Legacy — accepted and stored but no longer read; the splash draws the Site Design header wordmark. \"hover\" or \"always\"; anything else falls back to \"hover\".",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated profile" }, "401": ErrorResponse },
      },
    },
    "/artist-skills": {
      get: {
        tags: ["Artist Profile"],
        summary: "List artist skills (public)",
        responses: { "200": { description: "Skills" } },
      },
      put: {
        tags: ["Artist Profile"],
        summary: "Replace all artist skills (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["skills"],
                properties: {
                  skills: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { name: { type: "string" }, hoverColor: { type: "string" }, sortOrder: { type: "integer" } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated skills" }, "401": ErrorResponse },
      },
    },
    "/social-links": {
      get: {
        tags: ["Artist Profile"],
        summary: "List social links (public)",
        responses: { "200": { description: "Links" } },
      },
      put: {
        tags: ["Artist Profile"],
        summary: "Replace all social links (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["links"],
                properties: {
                  links: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated links" }, "401": ErrorResponse },
      },
    },
    "/theme": {
      get: {
        tags: ["Artist Profile"],
        summary: "Get site theme (public)",
        responses: { "200": { description: "Theme object" } },
      },
      put: {
        tags: ["Artist Profile"],
        summary: "Update site theme (admin)",
        description:
          "Partial update — only the fields sent are changed. Includes the Site Background Effect: `bgEffect` is one of none|zoom|drift|breathe|parallax and `bgEffectSpeedMs` (5000–60000) is one loop of a looping effect.",
        security: adminSecurity,
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { "200": { description: "Updated theme" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/favicon-frame": {
      get: {
        tags: ["Artist Profile"],
        summary: "Get favicon SVG for a given color (public)",
        parameters: [{ name: "color", in: "query", schema: { type: "string" }, description: "Hex color e.g. #FFE135" }],
        responses: { "200": { description: "SVG favicon", content: { "image/svg+xml": { schema: { type: "string" } } } } },
      },
    },

    // ═══════════════════════════════════════════════════════
    // SOUND EFFECTS
    // ═══════════════════════════════════════════════════════
    "/sound-effects": {
      get: {
        tags: ["Sound Effects"],
        summary: "Get all sound effect configs (public — fetched once per page load)",
        responses: { "200": { description: "Sound config map" } },
      },
    },
    "/sound-effects/config": {
      get: {
        tags: ["Sound Effects"],
        summary: "Get admin sound effects config",
        security: adminSecurity,
        responses: { "200": { description: "Admin sound effect list" }, "401": ErrorResponse },
      },
      put: {
        tags: ["Sound Effects"],
        summary: "Save one sound effect config (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["key"],
                properties: {
                  key: { type: "string" },
                  enabled: { type: "boolean" },
                  source: { type: "string" },
                  url: { type: "string" },
                  volume: { type: "number" },
                },
              },
            },
          },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // UPLOAD
    // ═══════════════════════════════════════════════════════
    "/upload": {
      post: {
        tags: ["Upload"],
        summary: "Upload image (admin, max 10 MB, JPEG/PNG/WebP/GIF)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          "200": { description: "Upload URL", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/upload/event-image": {
      post: {
        tags: ["Upload"],
        summary: "Upload Timeline/Events image (admin, max 10 MB, JPEG/PNG/WebP/GIF)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          "200": { description: "Upload URL", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/upload/event-video": {
      post: {
        tags: ["Upload"],
        summary: "Upload Timeline/Events video (admin, max 30 MB, MP4/MOV/WebM)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          "200": { description: "Upload URL", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/upload/audio": {
      post: {
        tags: ["Upload"],
        summary: "Upload audio file (admin, MP3/WAV/OGG/AAC/M4A)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          "200": { description: "Upload URL", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/upload/audio/sign": {
      post: {
        tags: ["Upload"],
        summary: "Get presigned PUT URL for audio (admin — bypasses Vercel body limit)",
        description:
          "Mints a presigned PUT to Cloudflare R2, valid for ten minutes and scoped to one object. The browser must PUT the file to `uploadUrl` with `Content-Type: <contentType>` and `Cache-Control: public, max-age=31536000, immutable` — both are part of the signature. Store `publicUrl`.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["filename"],
                properties: { filename: { type: "string" }, mimeType: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Presigned PUT",
            content: { "application/json": { schema: { type: "object", properties: { path: { type: "string" }, uploadUrl: { type: "string", format: "uri" }, publicUrl: { type: "string", format: "uri" }, contentType: { type: "string" } } } } },
          },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/upload/model/sign": {
      post: {
        tags: ["Upload"],
        summary: "Get presigned PUT URL for .glb model (admin — up to 100 MB)",
        description:
          "Mints a presigned PUT to Cloudflare R2, valid for ten minutes and scoped to one object. The browser must PUT the file to `uploadUrl` with `Content-Type: model/gltf-binary` and `Cache-Control: public, max-age=31536000, immutable`, then call /upload/model/optimize with `path`. Persist what that returns, not `publicUrl`.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["filename"], properties: { filename: { type: "string" } } },
            },
          },
        },
        responses: {
          "200": {
            description: "Presigned PUT",
            content: { "application/json": { schema: { type: "object", properties: { path: { type: "string" }, uploadUrl: { type: "string", format: "uri" }, publicUrl: { type: "string", format: "uri" } } } } },
          },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/upload/model/optimize": {
      post: {
        tags: ["Upload"],
        summary: "Compress an uploaded .glb (admin — Draco + WebP, ~10x)",
        description:
          "Second half of the model upload. Call with the path returned by /upload/model/sign once the browser has finished uploading to it. Fetches those bytes, compresses geometry with Draco and textures to WebP, writes the result to models/optimized/ and removes the raw upload. Store the returned `url` — it differs from the signing route's `publicUrl`. Never fails destructively: if compression is not possible the raw file's URL is returned with `optimized: false`.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["path"],
                properties: {
                  path: {
                    type: "string",
                    description: "In-bucket path of the raw upload, e.g. `models/1788635560806-mttgt8.glb`",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "The URL to persist. `optimized` says whether compression actually ran; `warning` is present when it was skipped.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    optimized: { type: "boolean" },
                    beforeBytes: { type: "integer" },
                    afterBytes: { type: "integer" },
                    warning: { type: "string" },
                  },
                },
              },
            },
          },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/upload/video": {
      post: {
        tags: ["Upload"],
        summary: "Upload video (admin, MP4/MOV/WebM)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          "200": { description: "Upload URL" },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════
    "/auth/check-password": {
      post: {
        tags: ["Auth"],
        summary: "UX pre-check — does this password match? Returns totpRequired flag",
        description: "No session issued. Real auth still happens in NextAuth signIn.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "ok + totpRequired flag", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, totpRequired: { type: "boolean" } } } } } },
          "401": ErrorResponse,
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Send password reset email",
        description: "Always returns the same generic message (no enumeration).",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } },
        },
        responses: { "200": { description: "Generic success message" }, "400": ErrorResponse },
      },
    },
    "/auth/reset-password": {
      get: {
        tags: ["Auth"],
        summary: "Validate reset token",
        parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Valid flag", content: { "application/json": { schema: { type: "object", properties: { valid: { type: "boolean" } } } } } },
          "400": ErrorResponse,
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Reset password with token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["token", "password"], properties: { token: { type: "string" }, password: { type: "string", minLength: 8 } } },
            },
          },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ADMIN — TOTP
    // ═══════════════════════════════════════════════════════
    "/admin/totp/setup": {
      post: {
        tags: ["Admin — Security"],
        summary: "Start 2FA enrollment — generates secret + QR code (admin)",
        security: adminSecurity,
        responses: {
          "200": { description: "Secret and QR code data URL", content: { "application/json": { schema: { type: "object", properties: { secret: { type: "string" }, qrCodeDataUrl: { type: "string" } } } } } },
          "401": ErrorResponse,
        },
      },
    },
    "/admin/totp/verify": {
      post: {
        tags: ["Admin — Security"],
        summary: "Confirm 2FA enrollment with a live code (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["code"], properties: { code: { type: "string", pattern: "^\\d{6}$" } } } } },
        },
        responses: {
          "200": { description: "Success + one-time recovery codes", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, recoveryCodes: { type: "array", items: { type: "string" } } } } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/admin/totp/disable": {
      post: {
        tags: ["Admin — Security"],
        summary: "Disable 2FA — requires password confirmation (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["password"], properties: { password: { type: "string" } } } } },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ADMIN — NOTIFICATIONS
    // ═══════════════════════════════════════════════════════
    "/admin/notifications": {
      get: {
        tags: ["Admin — Notifications"],
        summary: "List notifications (admin, paginated, filterable)",
        security: adminSecurity,
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["ORDER", "HIGHSCORE", "CONTACT", "MUSEUM"] } },
          { name: "subject", in: "query", schema: { type: "string" } },
          { name: "spam", in: "query", schema: { type: "string", enum: ["1"] } },
          { name: "archived", in: "query", schema: { type: "string", enum: ["1"] } },
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "pageSize", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Notifications + unread count + total" }, "401": ErrorResponse },
      },
      patch: {
        tags: ["Admin — Notifications"],
        summary: "Mark one or all notifications read (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Mark specific notification read" },
                  all: { type: "boolean", description: "Mark all unread as read" },
                },
              },
            },
          },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/admin/notifications/{id}": {
      patch: {
        tags: ["Admin — Notifications"],
        summary: "Toggle spam or archived flag on a notification (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { isSpam: { type: "boolean" }, isArchived: { type: "boolean" } },
              },
            },
          },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Admin — Notifications"],
        summary: "Soft-delete notification (moves to trash)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },
    "/admin/notifications/{id}/block": {
      post: {
        tags: ["Admin — Notifications"],
        summary: "Block sender email from a CONTACT notification (admin)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": { description: "Blocked email" }, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ADMIN — BLOCKED EMAILS
    // ═══════════════════════════════════════════════════════
    "/admin/blocked-emails": {
      get: {
        tags: ["Admin — Notifications"],
        summary: "List blocked emails (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Blocked emails" }, "401": ErrorResponse },
      },
      post: {
        tags: ["Admin — Notifications"],
        summary: "Block an email address (admin)",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" }, reason: { type: "string" } } },
            },
          },
        },
        responses: { "201": { description: "Blocked" }, "400": ErrorResponse, "401": ErrorResponse },
      },
    },
    "/admin/blocked-emails/{id}": {
      delete: {
        tags: ["Admin — Notifications"],
        summary: "Unblock email (admin, hard delete)",
        security: adminSecurity,
        parameters: [IdParam],
        responses: { "200": SuccessResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    "/admin/inactivity": {
      get: {
        tags: ["Admin — Security"],
        summary: "Read your automatic sign-out setting",
        description:
          "Always scoped to the caller's own account — this is a per-user preference about the machine they sign in from, so there is no way to address another user's setting. Returns 400 for an x-api-key caller, which has no session and therefore no own account.",
        security: adminSecurity,
        responses: {
          "200": { description: "{ enabled: boolean, minutes: number }" },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
      patch: {
        tags: ["Admin — Security"],
        summary: "Change your automatic sign-out setting",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  minutes: { type: "integer", enum: [10, 30, 60] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "{ enabled, minutes } as stored" },
          "400": ErrorResponse,
          "401": ErrorResponse,
          "500": ErrorResponse,
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ADMIN — OBSERVABILITY
    // ═══════════════════════════════════════════════════════
    "/admin/activity-log": {
      get: {
        tags: ["Admin — Observability"],
        summary: "Read the audit trail (admin)",
        description:
          "Filtered, sorted, offset-paginated activity log rows, plus per-category counts and the total row count. Backs Dashboard ▸ Activity Log.",
        security: adminSecurity,
        parameters: [
          {
            name: "category",
            in: "query",
            schema: { type: "string", enum: ["CONTENT", "AUTH", "COMMERCE", "VISITOR", "SYSTEM"] },
          },
          { name: "action", in: "query", schema: { type: "string" }, description: 'Exact dotted verb, e.g. "artwork.updated"' },
          { name: "actorType", in: "query", schema: { type: "string", enum: ["admin", "visitor", "system"] } },
          { name: "q", in: "query", schema: { type: "string" }, description: "Free text across summary, actor, IP and entity id" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["createdAt", "category", "action"] } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
        ],
        responses: {
          "200": { description: "Log rows, counts by category, total and totalPages" },
          "401": ErrorResponse,
          "500": ErrorResponse,
        },
      },
      delete: {
        tags: ["Admin — Observability"],
        summary: "Prune or purge the audit trail (admin)",
        description:
          "With no parameters, runs the ordinary retention prune (each category's own window). With `before` and/or `category`, permanently deletes the matching rows. The purge itself is recorded in the log.",
        security: adminSecurity,
        parameters: [
          { name: "before", in: "query", schema: { type: "string", format: "date-time" } },
          {
            name: "category",
            in: "query",
            schema: { type: "string", enum: ["CONTENT", "AUTH", "COMMERCE", "VISITOR", "SYSTEM"] },
          },
        ],
        responses: {
          "200": { description: "{ removed, mode: 'prune' | 'purge' }" },
          "400": ErrorResponse,
          "401": ErrorResponse,
          "500": ErrorResponse,
        },
      },
    },
    "/admin/system-health": {
      get: {
        tags: ["Admin — Observability"],
        summary: "Infrastructure health snapshot (admin)",
        description:
          "Vercel deployments, Postgres latency/size/connections, Cloudflare R2 bucket usage and this instance's own runtime metadata. Each section carries its own status ('ok' | 'unconfigured' | 'unauthorized' | 'error'), so the call succeeds even when an upstream is unreachable or the configured token lacks scope.",
        security: adminSecurity,
        responses: {
          "200": { description: "SystemHealthSnapshot — vercel, database, storage, app, capturedAt" },
          "401": ErrorResponse,
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // ADMIN — SEARCH & ANALYTICS
    // ═══════════════════════════════════════════════════════
    "/admin/search": {
      get: {
        tags: ["Admin — Misc"],
        summary: "Global admin search across all content types",
        security: adminSecurity,
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } }],
        responses: { "200": { description: "Search results grouped by type" }, "401": ErrorResponse },
      },
    },
    "/analytics": {
      get: {
        tags: ["Admin — Misc"],
        summary: "Website analytics for a date range (admin)",
        security: adminSecurity,
        parameters: [{ name: "days", in: "query", schema: { type: "integer" }, description: "7, 14, 30, 60, or 90" }],
        responses: {
          "200": {
            description:
              "Analytics snapshot for the range: totals, the daily series, top pages, traffic sources, a device breakdown and a per-country visitor breakdown (ISO 3166-1 alpha-2, empty string where the edge could not place the request). Sourced from Vercel Web Analytics, whose aggregate endpoint groups by country but has no city dimension.",
          },
          "401": ErrorResponse,
        },
      },
    },

    // ═══════════════════════════════════════════════════════
    // CONTACT
    // ═══════════════════════════════════════════════════════
    "/contact": {
      post: {
        tags: ["Contact"],
        summary: "Submit contact form (public, reCAPTCHA v3 required)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "subject", "message", "captchaToken"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  subject: { type: "string" },
                  message: { type: "string" },
                  captchaToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": SuccessResponse, "400": ErrorResponse, "403": ErrorResponse, "500": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // TRASH
    // ═══════════════════════════════════════════════════════
    "/trash": {
      get: {
        tags: ["Trash"],
        summary: "Get all soft-deleted items across every module (admin)",
        security: adminSecurity,
        responses: { "200": { description: "Trash contents grouped by type" }, "401": ErrorResponse },
      },
    },
    "/trash/{type}": {
      patch: {
        tags: ["Trash"],
        summary: "Restore every trashed item of one type (admin)",
        description:
          "Bulk counterpart to /trash/{type}/{id}. Runs the same per-item restore as the single-item route rather than one updateMany, because restoring a section revives only the rows trashed alongside it. A row that throws is counted in `failed` and skipped rather than aborting the run.",
        security: adminSecurity,
        parameters: [{ name: "type", in: "path", required: true, schema: { type: "string" }, description: "artworks, stories, cosplays, products, sections, rooms, events, announcements, marquees, notifications, freedom-wall-notes, freedom-wall-events, or release-notes" }],
        responses: {
          "200": { description: "{ done, failed } counts" },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
      delete: {
        tags: ["Trash"],
        summary: "Permanently delete every trashed item of one type (admin)",
        description:
          "Irreversible. Runs the same per-item purge as the single-item route, so each row's cascades and uploaded files are cleaned up; a set-based deleteMany would skip all of that. Scoped to one type — there is deliberately no endpoint that empties the whole Trash at once.",
        security: adminSecurity,
        parameters: [{ name: "type", in: "path", required: true, schema: { type: "string" }, description: "Same set as PATCH above" }],
        responses: {
          "200": { description: "{ done, failed } counts" },
          "400": ErrorResponse,
          "401": ErrorResponse,
        },
      },
    },
    "/trash/{type}/{id}": {
      patch: {
        tags: ["Trash"],
        summary: "Restore item from trash (admin)",
        security: adminSecurity,
        parameters: [
          { name: "type", in: "path", required: true, schema: { type: "string", enum: ["announcements", "marquees", "artworks", "stories", "cosplays", "products", "sections", "notifications", "rooms", "events", "freedom-wall-notes", "freedom-wall-events"] } },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
      delete: {
        tags: ["Trash"],
        summary: "Permanently delete item (admin)",
        security: adminSecurity,
        parameters: [
          { name: "type", in: "path", required: true, schema: { type: "string", enum: ["announcements", "marquees", "artworks", "stories", "cosplays", "products", "sections", "notifications", "rooms", "events", "freedom-wall-notes", "freedom-wall-events"] } },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": SuccessResponse, "400": ErrorResponse, "401": ErrorResponse, "404": ErrorResponse },
      },
    },

    // ═══════════════════════════════════════════════════════
    // BACKUP & RESTORE
    // ═══════════════════════════════════════════════════════
    // Three admin-only halves of one flow, all running with maxDuration 60.
    // The archive itself is built and unpacked in the browser
    // (lib/backup/zip.ts), not here: it also carries every uploaded file from
    // the storage CDN and can run to hundreds of megabytes, which a
    // serverless function streaming it through itself would not survive.
    "/backup/export": {
      post: {
        tags: ["Backup & Restore"],
        summary: "Export rows for the selected groups (admin)",
        description:
          "Returns the database half of a backup — the browser adds the media files and zips it. " +
          "Soft-deleted rows are included on purpose: they are what the Trash module restores from. " +
          "Secrets are stripped per REDACTED_FIELDS, and a model missing from the schema comes back " +
          "as an empty table in the manifest rather than failing the whole export.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["groups"],
                properties: {
                  groups: {
                    type: "array",
                    description: "Group ids to include (see lib/backup/groups.ts). At least one required.",
                    items: {
                      type: "string",
                      enum: ["settings", "gallery", "stories", "cosplays", "events", "shop", "minigames", "museum", "visitors", "accounts"],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Backup file — manifest plus one array of rows per model",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    manifest: {
                      type: "object",
                      properties: {
                        version: { type: "integer", description: "BACKUP_FORMAT_VERSION" },
                        exportedAt: { type: "string", format: "date-time" },
                        groups: { type: "array", items: { type: "string" } },
                        counts: { type: "object", additionalProperties: { type: "integer" }, description: "model → row count" },
                        includesMedia: { type: "boolean", description: "Always false here; the browser flips it when it bundles the files" },
                      },
                    },
                    data: { type: "object", additionalProperties: { type: "array", items: { type: "object" } }, description: "model → rows" },
                  },
                },
              },
            },
          },
          "400": ErrorResponse,
          "401": ErrorResponse,
          "500": ErrorResponse,
        },
      },
    },
    "/backup/import": {
      post: {
        tags: ["Backup & Restore"],
        summary: "Restore rows from a backup (admin)",
        description:
          "Upserts by primary key and never deletes — a restore adds back what is missing, overwrites " +
          "what is there, and leaves anything created since the export alone. A row that will not write " +
          "is reported in `skipped` rather than abandoning the rest. Order is taken from BACKUP_GROUPS " +
          "(parents first), not from the request. Revalidates the whole site on success.",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["groups", "data"],
                properties: {
                  groups: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["settings", "gallery", "stories", "cosplays", "events", "shop", "minigames", "museum", "visitors", "accounts"],
                    },
                  },
                  data: { type: "object", additionalProperties: { type: "array", items: { type: "object" } }, description: "model → rows, as produced by /backup/export" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Import report",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    restored: { type: "object", additionalProperties: { type: "integer" }, description: "model → rows written" },
                    skipped: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          model: { type: "string" },
                          id: { type: "string" },
                          reason: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": ErrorResponse,
          "401": ErrorResponse,
          "500": ErrorResponse,
        },
      },
    },
    "/backup/media": {
      post: {
        tags: ["Backup & Restore"],
        summary: "Restore one file from a backup archive to storage (admin, max 50 MB)",
        description:
          "Its own route rather than /upload, which is images-only at 10 MB — a backup also carries " +
          "audio, video and uploaded .glb models. The returned URL is a **new** object in the bucket, " +
          "so the caller must rewrite the rows referencing the old URL before posting them to " +
          "/backup/import (BackupClient.tsx's remapMediaUrls).",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          "200": { description: "New public URL for the restored file", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } } },
          "400": ErrorResponse,
          "401": ErrorResponse,
          "500": ErrorResponse,
        },
      },
    },
  },

  tags: [
    { name: "Artworks", description: "Artwork CRUD and share tracking" },
    { name: "Tales", description: "Books, novels, comics & manga (the Tales module; routes keep their /stories paths) — CRUD plus their page images" },
    { name: "Cosplays", description: "Costume photography \u2014 each a standee in the museum's Cosplay Room" },
    { name: "Sections", description: "Gallery section groupings" },
    { name: "Products", description: "Shop product listings tied to artworks" },
    { name: "Orders", description: "Customer orders (admin + public lookup)" },
    { name: "Releases", description: "The band's singles, EPs and albums — covers, tracklists, lyrics, streaming links" },
    { name: "Videos", description: "YouTube videos on the Videos page — music videos, live, behind the scenes" },
    { name: "Checkout", description: "PayMongo checkout session and webhook" },
    { name: "Announcements", description: "Timed site announcements" },
    { name: "Marquees", description: "Scrolling marquee announcements" },
    { name: "Release Notes", description: "Visitor-facing \u201cwhat\u2019s new\u201d entries shown in the site navbar" },
    { name: "FAQs", description: "Frequently asked questions" },
    { name: "Digital Museum", description: "3D museum — rooms, artworks, scene objects, achievements" },
    { name: "Mini Games", description: "Mini game sessions, leaderboard, rewards" },
    { name: "Freedom Wall", description: "Public sticky-note wall events and notes" },
    { name: "Chase Companions", description: "Museum floating companion assets" },
    { name: "Visitor", description: "Visitor count tracking and milestone rewards" },
    { name: "Artist Profile", description: "Profile, certificates, skills, social links, theme, favicon" },
    { name: "Sound Effects", description: "Site-wide sound effect configuration" },
    { name: "Upload", description: "Image, audio, video, and 3D model uploads to Cloudflare R2" },
    { name: "Auth", description: "Password reset and pre-login credential check" },
    { name: "Admin — Security", description: "TOTP (2FA) setup, verification, disable, and inactivity auto sign-out" },
    { name: "Admin — Notifications", description: "In-app notification bell, spam/archive, blocked emails" },
    { name: "Admin — Misc", description: "Global search and Vercel Analytics" },
    { name: "Admin — Observability", description: "Audit trail and infrastructure health — Dashboard ▸ Activity Log and System Health" },
    { name: "Contact", description: "Public contact form submission" },
    { name: "Trash", description: "Soft-deleted items — restore or permanently delete" },
    { name: "Backup & Restore", description: "Whole-site export/import — database rows plus uploaded media" },
  ],
};
