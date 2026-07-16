import os
import sys
import asyncio
import json
import asyncpg
import uuid

def get_uuid_for_id(raw_id: str) -> str:
    try:
        uuid.UUID(raw_id)
        return raw_id
    except ValueError:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, raw_id))

async def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set in environment.")
        return

    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print(f"Connecting to database to seed quiz scenarios...")
    conn = await asyncpg.connect(db_url)

    scenarios = [
        {
            "id": "click-web-challenge",
            "title": "Challenge 1 - ClickFix Pastejacking",
            "description": "Analyze the ClickFix pastejacking payload and retrieve the flag from the live target environment.",
            "difficulty": "Easy",
            "durationLabel": "1 Hour",
            "challenges": [
                {
                    "id": "click-web-1",
                    "title": "ClickFix Pastejacking Analysis",
                    "points": 100,
                    "difficulty": "Easy",
                    "category": "Web / Pastejacking",
                    "scenario": "Access the target challenge site and inspect the social engineering payload designed to trick users into executing malicious PowerShell commands via clipboard hijacking.",
                    "instructions": "Access the live challenge at https://click-web.cyberrange.kctf.cloud. Analyze the page and extract the flag.",
                    "hints": [
                        "Visit the page and inspect the copy-to-clipboard functionality.",
                        "Check how the script intercepts keypresses or click events to modify the clipboard content."
                    ],
                    "flag": "flag{cstar_clickfix_paste_success}",
                    "solutionText": "Visit the live challenge at https://click-web.cyberrange.kctf.cloud. Follow the steps to analyze the payload."
                }
            ]
        },
        {
            "id": "active-directory",
            "title": "Active Directory CyberRange",
            "description": "Multi-forest AD environment designed for practicing initial access, privilege escalation, and lateral movement.",
            "difficulty": "Medium",
            "durationLabel": "4 Hours",
            "challenges": [
                {
                    "id": "ad-1",
                    "title": "Reconnaissance & Initial Entry",
                    "points": 100,
                    "difficulty": "Easy",
                    "category": "Recon / Access",
                    "scenario": "You are connected to the internal LAN via VPN. Your first step is to scan the domain subnet, discover active hosts, and find an entry vector on the user workstation (WS01).",
                    "instructions": "Perform an Nmap scan on the workstation IP `10.10.10.50`. Locate the open HTTP service and find the developers secret token in the webpage metadata or source notes.\n\nFlag format: flag{secret_string}",
                    "hints": [
                        "Check port 80/http on 10.10.10.50.",
                        "Inspect the HTML comments in the developer staging page index source."
                    ],
                    "flag": "flag{cstar_ad_phish_access}",
                    "solutionText": "Use `nmap -sS -p80 10.10.10.50` to find the running web page. View-source:http://10.10.10.50/ and check the bottom comment block."
                },
                {
                    "id": "ad-2",
                    "title": "Local Privilege Escalation",
                    "points": 150,
                    "difficulty": "Medium",
                    "category": "PrivEsc",
                    "scenario": "You have compromised a low-privilege user session (`j.doe`) on the workstation `10.10.10.50`. You need to escalate privileges to local Administrator.",
                    "instructions": "Enumerate the system for misconfigurations. Check running tasks, services, or registry key paths. A poorly configured scheduled task executes a backup binary with high privileges. Replace the binary or hijack the execution path to retrieve the flag located in C:\\Users\\Administrator\\Desktop\\flag.txt.",
                    "hints": [
                        "Run `schtasks /query /fo LIST /v` to inspect scheduled tasks.",
                        "Check the folder write permissions on the BackupAgent executable path."
                    ],
                    "flag": "flag{cstar_ad_local_admin}",
                    "solutionText": "Run winPEAS or query scheduled tasks. Note that C:\\Program Files\\BackupAgent\\backup.exe is writeable by Authenticated Users. Overwrite it with a shell payload to read flag.txt."
                },
                {
                    "id": "ad-3",
                    "title": "Kerberoasting Service Accounts",
                    "points": 200,
                    "difficulty": "Medium",
                    "category": "Active Directory",
                    "scenario": "Now that you are local administrator on WS01, you have access to LSASS and AD tools. You need to extract active Kerberos service tickets (SPNs) and attempt to crack them offline.",
                    "instructions": "Request a service ticket for the SQL server service account (`sql_svc`) using Rubeus or native powershell commands. Extract the ticket hash, crack it locally using Hashcat with rockyou.txt, and submit the cracked password as the flag.",
                    "hints": [
                        "Use Rubeus: `Rubeus.exe kerberoast /simple` to request SPNs.",
                        "The cracked password follows the format flag{cracked_password}."
                    ],
                    "flag": "flag{cstar_ad_kerberoast_hash}",
                    "solutionText": "Execute `Rubeus.exe kerberoast` to get the Kerberos TGS hash. Run hashcat format 13100 to reveal the password 'RoastMePls!'."
                },
                {
                    "id": "ad-4",
                    "title": "Domain Admin Controller Takeover",
                    "points": 300,
                    "difficulty": "Hard",
                    "category": "Active Directory",
                    "scenario": "Using the compromised SQL service account credentials, target the Domain Controller `DC01` to gain full enterprise domain administrator rights.",
                    "instructions": "Inspect Active Directory access control lists. The SQL service account has generic write privileges over the DC01 computer account. Perform a Resource-Based Constrained Delegation (RBCD) attack or run bloodhound to find the path. Abuse this delegation to spoof a Domain Admin ticket and read the crown jewel flag from the Domain Controller's file share.",
                    "hints": [
                        "Configure delegation settings using PowerView or Impacket's rbcd.py.",
                        "Request a ticket for Administrator using S4U2self/S4U2proxy."
                    ],
                    "flag": "flag{cstar_ad_golden_ticket}",
                    "solutionText": "Abuse generic write permissions on DC01 computer object to set msDS-AllowedToActOnBehalfOfOtherIdentity. Obtain a domain administrator TGT using sql_svc permissions."
                }
            ]
        },
        {
            "id": "crapi",
            "title": "crAPI Web API Security Arena",
            "description": "OWASP API Top 10 training environment focusing on vehicle portals, token exploits, mass assignment, and SSRF vulnerabilities.",
            "difficulty": "Medium",
            "durationLabel": "3 Hours",
            "challenges": [
                {
                    "id": "crapi-1",
                    "title": "Broken Object Level Authorization (BOLA)",
                    "points": 100,
                    "difficulty": "Easy",
                    "category": "BOLA",
                    "scenario": "The crAPI application lets users view their own vehicle location coordinates. The REST endpoint checks coordinates based on vehicle ID UUIDs.",
                    "instructions": "Log in with your learner account and view your dashboard network calls. Identify the API endpoint `/identity/api/v1/vehicles/{id}/location`. Modify the request UUID to match another vehicle (e.g., query standard parameters or check community posts for targets) to leak coordinates and find the validation key flag.",
                    "hints": [
                        "Check the Community forum posts. User profiles disclose vehicle UUID values in public payloads.",
                        "Swap your vehicle ID in the Location request in Burp Suite or developer tools."
                    ],
                    "flag": "flag{cstar_crapi_bola_uuid}",
                    "solutionText": "Retrieve vehicle ID from public community posts, then GET /identity/api/v1/vehicles/OTHER_VEHICLE_UUID/location to extract coordinates containing flag."
                },
                {
                    "id": "crapi-2",
                    "title": "Broken User Auth (JWT alg None)",
                    "points": 150,
                    "difficulty": "Medium",
                    "category": "Broken Auth",
                    "scenario": "The platform's microservices rely on JSON Web Tokens (JWT) for authentication checks. The gateway verifies credentials but is poorly configured for cryptographic checks.",
                    "instructions": "Extract your authentication JWT token from headers. Decode it and modify the algorithm header parameter to `none` (or `None`). Set the user email payload field to `admin@crapi.local` to spoof an admin session, submit the request to `/identity/api/v1/admin/status`, and retrieve the response flag.",
                    "hints": [
                        "Set `alg` to `none` in the JWT header block.",
                        "Ensure you remove the signature part of the JWT (leave the trailing period: header.payload.)."
                    ],
                    "flag": "flag{cstar_crapi_jwt_alg_none}",
                    "solutionText": "Convert token header to {'alg': 'none', 'typ': 'JWT'}, payload to {'email': 'admin@crapi.local'}, encode in base64, remove signature block, and make request."
                },
                {
                    "id": "crapi-3",
                    "title": "Mass Assignment Exploitation",
                    "points": 200,
                    "difficulty": "Medium",
                    "category": "Mass Assignment",
                    "scenario": "The vehicle dashboard permits ordered parts catalog checkouts. A backend structure deserializes body parameters directly into database fields.",
                    "instructions": "Attempt to order a spare part. The request POSTs JSON data containing part details. Inject an unauthorized parameter (e.g., `\"status\": \"delivered\"` or `\"free_delivery\": true`) into the POST request body. Successfully bypass the checkout paywall, complete the transaction, and view the receipt flag.",
                    "hints": [
                        "Inspect parameters returned in GET /api/v1/orders/.",
                        "Add the key `\"status\": \"delivered\"` or `\"discount\": 100` to your POST body when creating an order."
                    ],
                    "flag": "flag{cstar_crapi_mass_assign}",
                    "solutionText": "Intercept POST /api/v1/orders, inject the mass assignment payload parameter 'status': 'delivered' to auto-approve purchase order without credit deduction."
                }
            ]
        },
        {
            "id": "initial-access",
            "title": "Initial Access Vectors & Smuggling",
            "description": "Simulated initial access operations focusing on pastejacking (ClickFix), HTML smuggling, and malicious LNK delivery payloads.",
            "difficulty": "Easy",
            "durationLabel": "2 Hours",
            "challenges": [
                {
                    "id": "ia-1",
                    "title": "HTML Smuggling Analysis",
                    "points": 100,
                    "difficulty": "Easy",
                    "category": "HTML Smuggling",
                    "scenario": "A target user was sent an HTML attachment which downloaded a malware payload locally without triggering perimeter gateway alarms.",
                    "instructions": "Analyze the provided smuggle script. The script uses Javascript Blob and URL.createObjectURL to compile a payload in the browser. Decode the base64 payload block in the script to find the hidden flag file content.",
                    "hints": [
                        "Locate the base64-encoded string representing the file payload inside the HTML script tags.",
                        "Decode it using cyberchef or terminal commands: `echo <base64> | base64 -d`."
                    ],
                    "flag": "flag{cstar_html_smuggle_blob}",
                    "solutionText": "Extract the base64 data array variable inside the HTML script block. Decode using command line base64 -d."
                },
                {
                    "id": "ia-2",
                    "title": "ClickFix Pastejacking Script",
                    "points": 120,
                    "difficulty": "Medium",
                    "category": "Pastejacking",
                    "scenario": "A social engineering vector tricks users into pressing Win+R, pasting a command from their clipboard, and pressing Enter to 'fix' a page error.",
                    "instructions": "Examine the clickfix template command. It copies a PowerShell command payload to the user's clipboard. Decode the nested powershell command arguments (e.g. check for -enc base64 payload parameters) to reveal the command server IP and flag.",
                    "hints": [
                        "Find the Base64 command inside the powershell argument `-enc` or `-EncodedCommand`.",
                        "Decode the UTF-16LE / Unicode base64 bytes to get the plain text script."
                    ],
                    "flag": "flag{cstar_clickfix_cmd_exec}",
                    "solutionText": "Decode the powershell encoded payload block. Remember Windows powershell uses Unicode (UTF-16LE) base64 formatting."
                }
            ]
        }
    ]

    import hashlib
    async with conn.transaction():
        for s in scenarios:
            content_id = get_uuid_for_id(s["id"])
            duration_minutes = 240
            
            # Map challenges to use UUIDs
            challenges_with_uuids = []
            for c in s["challenges"]:
                c_uuid = get_uuid_for_id(c["id"])
                c_copy = dict(c)
                c_copy["id"] = c_uuid
                challenges_with_uuids.append(c_copy)
                
            metadata = {
                "slug": s["id"],
                "lab_type": s["id"],
                "challenges": challenges_with_uuids,
                "totalPoints": sum(c["points"] for c in s["challenges"]),
                "estimatedDuration": duration_minutes // 60,
                "feature_chips": ["CTF", s["difficulty"]],
            }

            # 1. Insert content item first to satisfy foreign key
            await conn.execute("""
                INSERT INTO content_items (id, type, title, description, difficulty, duration_minutes, metadata, is_active)
                VALUES ($1, 'lab', $2, $3, $4, $5, $6::jsonb, true)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    difficulty = EXCLUDED.difficulty,
                    duration_minutes = EXCLUDED.duration_minutes,
                    metadata = EXCLUDED.metadata;
            """, content_id, s["title"], s["description"], s["difficulty"], duration_minutes, json.dumps(metadata))

            # 2. Insert challenges
            for c in s["challenges"]:
                c_uuid = get_uuid_for_id(c["id"])
                flag_hash = hashlib.sha256(c["flag"].strip().encode("utf-8")).hexdigest()
                
                await conn.execute("""
                    INSERT INTO challenges (
                        id, content_id, title, category, difficulty, points, 
                        flag_hash, scenario, instructions, hints, solution_text
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
                    ON CONFLICT (id) DO UPDATE SET
                        content_id = EXCLUDED.content_id,
                        title = EXCLUDED.title,
                        category = EXCLUDED.category,
                        difficulty = EXCLUDED.difficulty,
                        points = EXCLUDED.points,
                        flag_hash = EXCLUDED.flag_hash,
                        scenario = EXCLUDED.scenario,
                        instructions = EXCLUDED.instructions,
                        hints = EXCLUDED.hints,
                        solution_text = EXCLUDED.solution_text,
                        created_at = now();
                """, c_uuid, uuid.UUID(content_id), c["title"], c["category"], c["difficulty"], 
                     c["points"], flag_hash, c["scenario"], c["instructions"], json.dumps(c["hints"]), c.get("solutionText"))
                     
            print(f"Successfully seeded CTF Quiz: {s['title']} (ID: {content_id})")

    await conn.close()
    print("All quiz scenarios and challenges successfully seeded!")

if __name__ == "__main__":
    asyncio.run(main())
