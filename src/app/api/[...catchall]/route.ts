// SECTION: API_ROUTES
// PURPOSE: Unified API Gateway Bridge using static imports to prevent Webpack expression dependency warnings and secure all serverless routes on Vercel Hobby limits.

import { NextRequest, NextResponse } from "next/server";

// Static imports to allow Webpack bundling
const handlers: Record<string, any> = {
  "health": require("../../../../api/health"),
  "admin/discord-bot-guilds": require("../../../../api/admin/discord-bot-guilds"),
  "admin/discord-bot-dashboard": require("../../../../api/admin/discord-bot-dashboard"),
  "admin/discord-bot-action": require("../../../../api/admin/discord-bot-action"),
  "admin/[route]": require("../../../../api/admin/[route]"),
  "auth/discord/start": require("../../../../api/auth/discord/start"),
  "auth/discord/callback": require("../../../../api/auth/discord/callback"),
  "auth/discord/exchange": require("../../../../api/auth/discord/exchange"),
  "auth/google/start": require("../../../../api/auth/google/start"),
  "auth/google/callback": require("../../../../api/auth/google/callback"),
  "scan/sapphire/[action]": require("../../../../api/scan/sapphire/[action]"),
  "ai/analyze": require("../../../../api/ai/analyze"),
};

// Mock Response for Express-like compatibility
class ExpressMockResponse {
  statusCode = 200;
  headers = new Map<string, string>();
  body: any = null;
  ended = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
    return this;
  }

  json(data: any) {
    this.body = data;
    this.ended = true;
    return this;
  }

  send(data: any) {
    this.body = data;
    this.ended = true;
    return this;
  }
}

async function handleGateway(req: NextRequest, { params }: { params: { catchall: string[] } }) {
  const catchall = await params.catchall;
  let apiPath = catchall.join("/");
  
  // Custom query variables to inject dynamic params
  const extraQuery: Record<string, string> = {};

  // Resolve matching handler (with dynamic fallback logic)
  let handler = handlers[apiPath];

  if (!handler) {
    // Check for admin dynamic [route] (e.g., api/admin/staff -> api/admin/[route])
    if (catchall[0] === "admin" && catchall.length === 2) {
      apiPath = "admin/[route]";
      handler = handlers[apiPath];
      extraQuery["route"] = catchall[1];
    }
    // Check for scan sapphire dynamic [action] (e.g., api/scan/sapphire/run -> api/scan/sapphire/[action])
    else if (catchall[0] === "scan" && catchall[1] === "sapphire" && catchall.length === 3) {
      apiPath = "scan/sapphire/[action]";
      handler = handlers[apiPath];
      extraQuery["action"] = catchall[2];
    }
  }

  if (!handler) {
    return NextResponse.json({ error: `API endpoint /api/${apiPath} not found` }, { status: 404 });
  }

  try {
    // Mock Express Request properties
    const searchParams = req.nextUrl.searchParams;
    const query: Record<string, string> = { ...extraQuery };
    searchParams.forEach((val, key) => {
      query[key] = val;
    });

    let body = {};
    if (req.method === "POST" || req.method === "PUT") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const mockReq = {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      query,
      body,
    };

    const mockRes = new ExpressMockResponse();

    // Call the statically imported handler
    await handler(mockReq, mockRes);

    const responseHeaders: Record<string, string> = {};
    mockRes.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    if (typeof mockRes.body === "object") {
      return NextResponse.json(mockRes.body, {
        status: mockRes.statusCode,
        headers: responseHeaders,
      });
    }

    return new NextResponse(mockRes.body, {
      status: mockRes.statusCode,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`Gateway failed routing to API /api/${apiPath}:`, err);
    return NextResponse.json(
      { error: "Internal Gateway Error", message: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, context: any) {
  return handleGateway(req, context);
}

export async function POST(req: NextRequest, context: any) {
  return handleGateway(req, context);
}

export async function PUT(req: NextRequest, context: any) {
  return handleGateway(req, context);
}

export async function DELETE(req: NextRequest, context: any) {
  return handleGateway(req, context);
}
