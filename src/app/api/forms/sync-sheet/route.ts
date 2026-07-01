import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { sheetUrl } = await req.json();
    if (!sheetUrl) {
      return NextResponse.json({ error: 'Missing sheetUrl' }, { status: 400 });
    }

    const matches = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid Google Sheet URL' }, { status: 400 });
    }
    const spreadsheetId = matches[1];

    const sheetsToSync = [
      { name: "Başvurular", defaultStatus: "Yeni Başvuru" },
      { name: "Spam", defaultStatus: "Spam" },
      { name: "BlackList", defaultStatus: "BlackList" },
      { name: "Arşiv", defaultStatus: "Arşiv", gid: "401941768" }
    ];

    let totalSynced = 0;
    const syncLogs: string[] = [];

    for (const s of sheetsToSync) {
      try {
        let csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
        if (s.gid) {
          csvUrl += `&gid=${s.gid}`;
        } else {
          csvUrl += `&sheet=${encodeURIComponent(s.name)}`;
        }

        const response = await fetch(csvUrl);
        if (!response.ok) {
          syncLogs.push(`${s.name} fetch failed: HTTP ${response.status} ${response.statusText}`);
          continue;
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        if (rows.length <= 1) {
          syncLogs.push(`${s.name} is empty or only has headers`);
          continue;
        }

        const records = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const id = row[0];
          // Set status and clean it up (for Archive sheet, status is row[1])
          const status = row[1] || s.defaultStatus;
          const dateStr = row[2];
          const email = row[3];
          const fullName = row[4];
          const discordTag = row[6];

          if (!id || !email) continue;

          const rawAnswers = {
            id: id,
            email: email,
            fullName: fullName,
            birthDate: row[5],
            discordInfo: discordTag,
            discordUsage: row[7],
            penaltyHistory: row[8],
            micQuality: row[9],
            motivation: row[10],
            teamwork: row[11],
            moderationPurpose: row[12],
            experience: row[13],
            regret: row[14],
            availability: row[15],
            timeWindows: row[16],
            chatControversy: row[17],
            tenseUserScenario: row[18],
            minecraftScenario: row[19],
            unacceptableBehaviors: row[20],
            additionalInfo: row[21],
            infoConsent: row[22]
          };

          records.push({
            applicant_id: id,
            status: status,
            form_type: 'application',
            full_name: fullName || null,
            discord_tag: discordTag || null,
            email: email || null,
            raw_answers: rawAnswers,
            created_at: parseSheetDate(dateStr)
          });
        }

        if (records.length > 0) {
          // Deduplicate records to avoid PostgreSQL "ON CONFLICT DO UPDATE command cannot affect row a second time" error
          const uniqueRecords = [];
          const seenIds = new Set();
          for (let k = records.length - 1; k >= 0; k--) {
            const rec = records[k];
            if (!seenIds.has(rec.applicant_id)) {
              seenIds.add(rec.applicant_id);
              uniqueRecords.push(rec);
            }
          }
          uniqueRecords.reverse();

          const { error } = await supabase
            .from('staff_applications')
            .upsert(uniqueRecords, { onConflict: 'applicant_id' });
          
          if (error) {
            syncLogs.push(`${s.name} upsert failed: ${error.message}`);
          } else {
            totalSynced += uniqueRecords.length;
            syncLogs.push(`${s.name} successfully synced ${uniqueRecords.length} records`);
          }
        }
      } catch (err: any) {
        syncLogs.push(`${s.name} catch error: ${err.message || err}`);
      }
    }

    return NextResponse.json({ success: true, totalSynced, logs: syncLogs });
  } catch (err: any) {
    console.error('Sync sheet error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Simple CSV parser
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentField.trim());
      lines.push(row);
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (row.length > 0 || currentField) {
    row.push(currentField.trim());
    lines.push(row);
  }
  return lines;
}

function parseSheetDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const parts = dateStr.split(' ');
    if (parts.length < 2) return new Date().toISOString();
    const dParts = parts[0].split('.');
    const tParts = parts[1].split(':');
    if (dParts.length < 3 || tParts.length < 2) return new Date().toISOString();
    
    const date = new Date(
      parseInt(dParts[2], 10),
      parseInt(dParts[1], 10) - 1,
      parseInt(dParts[0], 10),
      parseInt(tParts[0], 10),
      parseInt(tParts[1], 10),
      tParts[2] ? parseInt(tParts[2], 10) : 0
    );
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}
