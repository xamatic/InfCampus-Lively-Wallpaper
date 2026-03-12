# Cookie Authentication Instructions

## The Problem
The session cookie alone (JSESSIONID) isn't enough. The school's API likely needs:
- Multiple cookies (not just JSESSIONID)
- Additional headers (like Referer, Origin, etc.)
- A fresh/active session

## Solution: Get a Complete Working Cookie String

### Method 1: Using Browser DevTools (Recommended)

1. **Log into the school portal:**
   - Go to https://410.ncsis.gov/campus/resources/portal/grades
   - Log in with your credentials

2. **Open DevTools Network Tab:**
   - Press `F12`
   - Click the **Network** tab
   - Make sure "Preserve log" is checked

3. **Refresh the page** (F5) to capture the request

4. **Find the grades request:**
   - Look for a request to `grades` in the list
   - Click on it

5. **Copy ALL cookies:**
   - In the **Headers** section on the right
   - Scroll down to **Request Headers**
   - Find the `Cookie:` header
   - Copy the ENTIRE value (it will be very long with multiple cookies)
   
   Example format:
   ```
   JSESSIONID=ABC123...; __cflb=xyz789...; other_cookie=value...
   ```

6. **Paste into widget:**
   - Go back to your widget
   - Click "⚙️ Setup Authentication"
   - Paste the entire cookie string
   - Click Save

### Method 2: Using Console

1. While logged into https://410.ncsis.gov/campus/resources/portal/grades
2. Press F12 and go to Console
3. Run this command:
   ```javascript
   copy(document.cookie)
   ```
4. The cookies are now in your clipboard
5. Paste into the widget's cookie input

## Important Notes

- **Sessions expire**: You may need to get a fresh cookie periodically
- **One request shows 200 OK**: This suggests the cookie worked briefly - get a fresh one
- **Multiple cookies**: The server likely needs more than just JSESSIONID

## If Still Getting 401

The API might require:
1. Being accessed only from the school's network
2. Additional authentication beyond cookies
3. Specific request headers that can't be spoofed

In that case, this widget approach won't work without additional infrastructure.
