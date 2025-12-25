# Threads Access Token Expired - How to Fix

## Problem

Your Threads access token has expired. The error shows:

```
Error validating access token: Session has expired on Wednesday, 10-Dec-25 20:00:00 PST.
```

## Solution Options

### Option 1: Try to Refresh the Token (Quick)

Run the refresh script:

```bash
cd apps/backend
node scripts/refresh-token.js
```

If successful, copy the new token from the output and update your `.env` file.

### Option 2: Generate a New Long-Lived Access Token (Recommended)

If the refresh fails, you need to generate a new long-lived access token:

#### Step 1: Go to Meta Developer Console

1. Visit: https://developers.facebook.com/apps/
2. Select your app: **Your App ID: 1350363546633894**
3. Go to "Threads" → "Settings" in the left sidebar

#### Step 2: Generate User Access Token

1. In the Threads settings, find the "User Access Tokens" section
2. Click "Generate Token"
3. Follow the authorization flow to connect your Threads account
4. You'll receive:
   - Short-lived access token (1 hour)
   - You need to exchange it for a long-lived token (60 days)

#### Step 3: Exchange for Long-Lived Token

Use this curl command (replace `YOUR_SHORT_LIVED_TOKEN` with the token from Step 2):

```bash
curl -X POST 'https://graph.threads.net/access_token' \
  -d 'grant_type=th_exchange_token' \
  -d 'client_secret=ae08b510b97ee701b68df7800c5888e8' \
  -d 'access_token=YOUR_SHORT_LIVED_TOKEN'
```

Or use the Node.js script:

```bash
cd apps/backend
TEMP_TOKEN="YOUR_SHORT_LIVED_TOKEN" node -e "
const axios = require('axios');
axios.post('https://graph.threads.net/access_token', {
  grant_type: 'th_exchange_token',
  client_secret: 'ae08b510b97ee701b68df7800c5888e8',
  access_token: process.env.TEMP_TOKEN
}).then(res => {
  console.log('New Access Token:', res.data.access_token);
  console.log('Expires in:', res.data.expires_in, 'seconds');
  const expiry = new Date(Date.now() + res.data.expires_in * 1000);
  console.log('Expires at:', expiry.toLocaleString());
}).catch(err => console.error('Error:', err.response?.data || err.message));
"
```

#### Step 4: Update .env File

Update these lines in `apps/backend/.env`:

```env
THREADS_ACCESS_TOKEN=<NEW_LONG_LIVED_TOKEN>
```

#### Step 5: Restart the Server

```bash
npm run dev
```

## Understanding Token Expiration

- **Short-lived tokens**: Expire in 1 hour
- **Long-lived tokens**: Expire in 60 days
- **Refresh tokens**: Can be used to get a new long-lived token (if not expired)

## Prevention

To avoid this issue in the future:

1. **Set up automatic token refresh**: The system should automatically refresh tokens before they expire
2. **Monitor token expiration**: Add alerts when tokens are about to expire
3. **Implement proper credential management**: Store and manage tokens in the database (currently not implemented)

## Current Status

Currently, the system uses environment variables for credentials. The database credential system (`ThreadsCredential` model) is not yet implemented. Once implemented, it will handle automatic token refresh.

## Need Help?

If you continue to have issues:

1. Verify your app is properly configured in the Meta Developer Console
2. Ensure your Threads account is connected to the app
3. Check that your app has the correct permissions
4. Make sure you're using the correct User ID: `25294120560278260`
