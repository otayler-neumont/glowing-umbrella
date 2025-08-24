import { apiBase } from '@/lib/aws';

export const dynamic = 'force-dynamic';

async function proxy(req: Request, segments: string[]): Promise<Response> {
	const targetUrl = `${apiBase}/${segments.map(encodeURIComponent).join('/')}`;
	const headers = new Headers();
	const auth = req.headers.get('authorization');
	const ct = req.headers.get('content-type');
	if (auth) headers.set('authorization', auth);
	if (ct) headers.set('content-type', ct);
	headers.set('accept', '*/*');

	const init: RequestInit = {
		method: req.method,
		headers,
		cache: 'no-store',
	};
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		(init as any).body = await req.arrayBuffer();
	}

	const res = await fetch(targetUrl, init);
	const buf = await res.arrayBuffer();
	const outHeaders = new Headers();
	const rct = res.headers.get('content-type');
	if (rct) outHeaders.set('content-type', rct);
	return new Response(buf, { status: res.status, headers: outHeaders });
}

export async function GET(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
	const { segments } = await params;
	return proxy(request, segments);
}
export async function POST(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
	const { segments } = await params;
	return proxy(request, segments);
}
export async function PUT(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
	const { segments } = await params;
	return proxy(request, segments);
}
export async function PATCH(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
	const { segments } = await params;
	return proxy(request, segments);
}
export async function DELETE(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
	const { segments } = await params;
	return proxy(request, segments);
}


