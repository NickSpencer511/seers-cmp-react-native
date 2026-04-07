# @seers/react-native-cmp

Seers Consent Management Platform SDK for React Native.

## Installation

```bash
npm install @seers/react-native-cmp
# or
yarn add @seers/react-native-cmp
```

Also install peer dependency:
```bash
npm install @react-native-async-storage/async-storage
```

## Usage

```js
import SeersCMP from '@seers/react-native-cmp';

// In App.js or index.js
SeersCMP.initialize({ settingsId: 'YOUR_SETTINGS_ID' });
```

Get your **Settings ID** from [seers.ai](https://seers.ai) dashboard → Mobile Apps → Get Code.

## What it does automatically
- ✅ Shows consent banner based on your dashboard settings
- ✅ Detects user region (GDPR / CPRA / none)
- ✅ Blocks trackers until consent is given
- ✅ Saves consent to AsyncStorage
- ✅ Logs consent to your Seers dashboard
