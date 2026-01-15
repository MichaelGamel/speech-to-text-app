# Testing Global Speech-to-Text Feature

## Overview
Your app now has **TWO** modes:
1. **Manual UI** - The window you see (for testing/manual transcription)
2. **Global Hotkey** - Background service (like Flow)

## Testing the Global Hotkey (Flow-like feature)

### Step 1: Start the App
```bash
cd apps/desktop
pnpm electron:dev
```

### Step 2: Check Console Output
Look for these messages in the terminal:
```
✓ Global hotkey registered successfully: CommandOrControl+Shift+Space
✓ Overlay window created
```

### Step 3: Test in Another App

1. **Open TextEdit**:
   ```bash
   open -a TextEdit
   ```

2. **Click in the text area** to focus it

3. **Press `Cmd+Shift+Space`**
   - Look for a floating overlay in the **top-right corner** of your screen
   - Should show "Listening..." with a pulsing red dot

4. **Say something**: "Hello world, this is a test"

5. **Press `Cmd+Shift+Space`** again to stop

6. **Check TextEdit**: The text should appear automatically

### Step 4: Expected Behavior

**When you press the hotkey:**
- Overlay appears instantly
- Shows "Listening..." text
- Red pulsing dot indicates recording
- Live transcript preview (if Deepgram API key is set)

**When you press hotkey again:**
- Overlay disappears
- Text is injected into focused field
- Original clipboard is restored (if enabled in settings)

## Troubleshooting

### Overlay Doesn't Appear?
1. Check console for errors
2. Verify no other app is using `Cmd+Shift+Space`
3. Try clicking the app window first

### Text Doesn't Inject?
1. **Grant Accessibility Permission**:
   - System Preferences → Security & Privacy → Privacy → Accessibility
   - Add "Electron" to the list and enable it

2. **Check Console** for injection errors

### No Transcription?
- Without Deepgram API key: Uses local Whisper (slower, but works offline)
- With Deepgram API key: Real-time transcription (faster)

## Configuration

### Default Settings
- **Hotkey**: `Cmd+Shift+Space`
- **STT Provider**: Whisper (offline)
- **Overlay Position**: Top-right
- **Preserve Clipboard**: Yes

### To Change Settings
Use the Settings IPC APIs (Settings UI coming in next phase).

## What You Should See

### Main Window
Shows the status indicator:
```
🟢 Global Hotkey Active: Cmd+Shift+Space
Press the hotkey from any app to start voice-to-text
```

### Overlay Window
Small floating pill (350x70px) in top-right corner:
```
🔴 Listening... [duration]
[Live transcript preview]
```

## Debug Mode

Enable debug logging:
```bash
export DEBUG=true
pnpm electron:dev
```

This will show detailed logs for:
- Hotkey registration
- Recording start/stop
- Audio streaming
- Transcription results
- Text injection

## Expected Console Output

```
[Main] Global hotkey registered successfully: CommandOrControl+Shift+Space
[Main] Overlay window created
[Main] Streaming service initialized
[Hotkey] Global recording started via hotkey
[Audio] Audio capture started successfully
[STT] Streaming started in whisper mode
[STT] Transcript update: "Hello world"
[Hotkey] Global recording stopped via hotkey
[Injection] Text injected successfully
```

## Next Steps

If everything works:
1. Configure a custom hotkey
2. Add Deepgram API key for real-time transcription
3. Test in different applications (VS Code, Safari, Slack, etc.)
4. Adjust overlay position if needed
