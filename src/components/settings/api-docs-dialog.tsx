'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  BookOpen,
  Code2,
  Copy,
  Check,
  KeyRound,
  Send,
  Users,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ApiDocsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiDocsDialog({ open, onOpenChange }: ApiDocsDialogProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://api.easyets.com';
  const baseUrl = `${origin}/api/v1`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedSection((prev) => (prev === label ? null : prev));
    }, 2000);
  };

  const curlSendMessage = `curl -X POST "${baseUrl}/messages" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+919809803210",
    "type": "text",
    "text": "Hello! Your booking has been confirmed via EasyETS."
  }'`;

  const nodeSendMessage = `const response = await fetch("${baseUrl}/messages", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    to: "+919809803210",
    type: "text",
    text: "Hello! Your booking has been confirmed via EasyETS."
  })
});

const data = await response.json();
console.log(data);`;

  const pythonSendMessage = `import requests

url = "${baseUrl}/messages"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "to": "+919809803210",
    "type": "text",
    "text": "Hello! Your booking has been confirmed via EasyETS."
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;

  const sampleSuccessResponse = `{
  "data": {
    "message_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "whatsapp_message_id": "wamid.HBgMOTE5ODA5ODAzMjEwFQIAERgSRjQ1...",
    "conversation_id": "4a12ec56-88c9-4a92-959c-85152b115664",
    "contact_id": "6c45f891-2391-4d92-a6e5-4b1152a9bc71",
    "contact_created": false
  }
}`;

  const sampleErrorResponse = `{
  "error": "bad_request",
  "message": "'to' is required and must be in E.164 international format (e.g. +919809803210)"
}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto p-6 rounded-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400">
              <BookOpen className="size-4.5" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              EasyETS REST API Integration Guide
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete guide on authenticating, sending WhatsApp messages, managing contacts, and inspecting responses.
          </DialogDescription>
        </DialogHeader>

        {/* Base URL Box */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-bold shrink-0">
              API Base URL
            </Badge>
            <code className="text-xs font-mono font-semibold text-emerald-950 dark:text-emerald-200 truncate">
              {baseUrl}
            </code>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(baseUrl, 'Base URL')}
            className="h-7 px-2 text-xs text-emerald-800 hover:text-emerald-900 hover:bg-emerald-100/60 dark:text-emerald-300 dark:hover:bg-emerald-900/40 shrink-0 cursor-pointer"
          >
            {copiedSection === 'Base URL' ? (
              <Check className="size-3.5 mr-1 text-emerald-600" />
            ) : (
              <Copy className="size-3.5 mr-1" />
            )}
            Copy
          </Button>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="auth" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9 bg-muted/80 p-1 rounded-xl">
            <TabsTrigger value="auth" className="text-xs font-semibold gap-1.5 cursor-pointer">
              <KeyRound className="size-3.5" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="messages" className="text-xs font-semibold gap-1.5 cursor-pointer">
              <Send className="size-3.5" />
              Send Message
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs font-semibold gap-1.5 cursor-pointer">
              <Users className="size-3.5" />
              Contacts API
            </TabsTrigger>
            <TabsTrigger value="code" className="text-xs font-semibold gap-1.5 cursor-pointer">
              <Code2 className="size-3.5" />
              Code Snippets
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Authentication */}
          <TabsContent value="auth" className="space-y-4 pt-3">
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                API Key Kahan Lagega? (How to Authenticate)
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aapke dwara generate ki gayi API key ko har HTTP request ke{' '}
                <strong className="text-foreground">Authorization</strong> header me{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground font-semibold">Bearer &lt;YOUR_API_KEY&gt;</code> ke roop me bhejna hota hai.
              </p>

              <div className="rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 dark:bg-zinc-900 border border-zinc-800 space-y-1 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      'Authorization: Bearer YOUR_API_KEY\nContent-Type: application/json',
                      'Headers'
                    )
                  }
                  className="absolute right-2 top-2 h-6 px-2 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  {copiedSection === 'Headers' ? (
                    <Check className="size-3 mr-1 text-emerald-400" />
                  ) : (
                    <Copy className="size-3 mr-1" />
                  )}
                  Copy
                </Button>
                <p className="text-zinc-400 text-[11px] mb-2 font-sans font-medium">HTTP Request Headers:</p>
                <p>
                  <span className="text-emerald-400">Authorization:</span> Bearer wab_live_3f8a9e2b1c4d...
                </p>
                <p>
                  <span className="text-emerald-400">Content-Type:</span> application/json
                </p>
              </div>
            </div>

            {/* Verification Endpoint */}
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Quick Authentication Test
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    GET
                  </Badge>
                  <code className="text-xs font-mono text-muted-foreground">/api/v1/me</code>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apni API key test karne ke liye <code className="font-mono text-foreground">/api/v1/me</code> par request karein. Ye aapka account status aur key scopes return karega:
              </p>
              <div className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-emerald-400 dark:bg-zinc-900 border border-zinc-800">
                curl -H &quot;Authorization: Bearer YOUR_API_KEY&quot; {baseUrl}/me
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Send Message */}
          <TabsContent value="messages" className="space-y-4 pt-3">
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Send WhatsApp Message
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Kisi bhi customer ke WhatsApp par text ya template message bhejein.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                    POST
                  </Badge>
                  <code className="text-xs font-mono font-semibold text-foreground">
                    /api/v1/messages
                  </code>
                </div>
              </div>

              {/* Request Body Payload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Request Body (JSON Payload):
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            to: '+919809803210',
                            type: 'text',
                            text: 'Hello! Your booking has been confirmed via EasyETS.',
                          },
                          null,
                          2
                        ),
                        'Payload'
                      )
                    }
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Copy className="size-3 mr-1" /> Copy Payload
                  </Button>
                </div>
                <pre className="rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 dark:bg-zinc-900 border border-zinc-800 overflow-x-auto">
{`{
  "to": "+919809803210",       // Required (E.164 international format)
  "type": "text",              // "text" | "template" | "document" | "image"
  "text": "Hello! Your booking has been confirmed via EasyETS."
}`}
                </pre>
              </div>

              {/* Template example */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Template Message Example (Meta Approved Templates):
                </span>
                <pre className="rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 dark:bg-zinc-900 border border-zinc-800 overflow-x-auto">
{`{
  "to": "+919809803210",
  "type": "template",
  "template": {
    "name": "booking_confirmation",
    "language": "en",
    "params": ["Dheeraj", "INV-1024"]
  }
}`}
                </pre>
              </div>

              {/* Success Response */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono text-[10px]">
                    201 Created
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">
                    Success Response:
                  </span>
                </div>
                <pre className="rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-emerald-400 dark:bg-zinc-900 border border-zinc-800 overflow-x-auto">
                  {sampleSuccessResponse}
                </pre>
              </div>

              {/* Error Response */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-red-400 bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-mono text-[10px]">
                    400 Bad Request
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">
                    Error Response:
                  </span>
                </div>
                <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-red-400 dark:bg-zinc-900 border border-zinc-800 overflow-x-auto">
                  {sampleErrorResponse}
                </pre>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Contacts API */}
          <TabsContent value="contacts" className="space-y-4 pt-3">
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Contacts Management Endpoints</h4>
              
              {/* Endpoint 1: List Contacts */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">List Contacts</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">GET</Badge>
                    <code className="text-xs font-mono text-foreground">/api/v1/contacts</code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports query params: <code className="font-mono text-[11px]">?search=phone_or_name</code>, <code className="font-mono text-[11px]">?limit=25</code>
                </p>
              </div>

              {/* Endpoint 2: Create Contact */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Create or Find Contact</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-600 text-white font-mono text-[10px]">POST</Badge>
                    <code className="text-xs font-mono text-foreground">/api/v1/contacts</code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Agar number pehle se exist karta hai toh existing contact return hota hai, otherwise naya create hota hai:
                </p>
                <pre className="rounded bg-zinc-950 p-2.5 font-mono text-xs text-zinc-100 dark:bg-zinc-900 overflow-x-auto">
{`{
  "phone": "+919809803210",
  "name": "Dheeraj Mobility",
  "email": "dheeraj@mobilitysum.com"
}`}
                </pre>
              </div>

              {/* Other Endpoints */}
              <div className="pt-2 border-t border-border/60 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Other Supported Endpoints:</p>
                <ul className="text-xs text-muted-foreground space-y-1 font-mono">
                  <li>• <strong className="text-foreground">GET /api/v1/conversations</strong> — Live chat threads list</li>
                  <li>• <strong className="text-foreground">POST /api/v1/broadcasts</strong> — Trigger bulk broadcast campaign</li>
                  <li>• <strong className="text-foreground">GET /api/v1/webhooks</strong> — List outbound webhook subscriptions</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: Code Snippets */}
          <TabsContent value="code" className="space-y-4 pt-3">
            {/* cURL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-emerald-600" />
                  cURL (Command Line):
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(curlSendMessage, 'cURL')}
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copiedSection === 'cURL' ? (
                    <Check className="size-3 mr-1 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 mr-1" />
                  )}
                  Copy cURL
                </Button>
              </div>
              <pre className="rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 dark:bg-zinc-900 border border-zinc-800 overflow-x-auto">
                {curlSendMessage}
              </pre>
            </div>

            {/* Node.js */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 className="size-3.5 text-amber-500" />
                  JavaScript / Node.js (fetch):
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(nodeSendMessage, 'Node.js')}
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copiedSection === 'Node.js' ? (
                    <Check className="size-3 mr-1 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 mr-1" />
                  )}
                  Copy JS
                </Button>
              </div>
              <pre className="rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 dark:bg-zinc-900 border border-zinc-800 overflow-x-auto">
                {nodeSendMessage}
              </pre>
            </div>

            {/* Python */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-blue-500" />
                  Python (requests):
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(pythonSendMessage, 'Python')}
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copiedSection === 'Python' ? (
                    <Check className="size-3 mr-1 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 mr-1" />
                  )}
                  Copy Python
                </Button>
              </div>
              <pre className="rounded-lg bg-zinc-950 p-3.5 font-mono text-xs text-zinc-100 dark:bg-zinc-900 border border-zinc-800 overflow-x-auto">
                {pythonSendMessage}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
