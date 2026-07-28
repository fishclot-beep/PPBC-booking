# 將管理後台接上 PostgreSQL

1. 建立 PostgreSQL 資料庫，例如 `sports_booking`。
2. 複製 `.env.example` 成 `.env.local`，填入 `DATABASE_URL`、至少 32 字元的 `SESSION_SECRET`，以及 LINE Developers Console 的 `LINE_CHANNEL_ID`、`NEXT_PUBLIC_LINE_LIFF_ID`。
3. 執行資料庫結構：

   ```powershell
   psql $env:DATABASE_URL -f ..\docs\booking-system-schema.sql
   psql $env:DATABASE_URL -f .\db\001_admin_settings.sql
   ```

4. 建立第一位管理員。`U_REPLACE_WITH_REAL_LINE_ID` 必須替換為該管理員實際的 LINE user ID：

   ```sql
   INSERT INTO members (line_user_id, display_name, role)
   VALUES ('U_REPLACE_WITH_REAL_LINE_ID', '系統管理員', 'admin');
   ```

5. 在 LINE Developers Console 建立 LIFF app，Endpoint URL 填入部署後的 HTTPS 網址，並開啟 `openid` scope。使用者開啟系統時，LIFF 會自動導向 LINE Login；伺服器會用 LINE 的 Verify ID token API 驗證身分後才建立 session。

已提供 API：`/api/admin/venue`、`/api/admin/admins`、`/api/admin/members`、`/api/admin/availability`。最後一個 API 可新增、列出及移除場地鎖定；`full_only` 規則會只允許籃球全場，不會誤鎖全場。

所有端點都只接受經 LINE 驗證後、且資料庫角色為 `admin` 的管理者 session。
