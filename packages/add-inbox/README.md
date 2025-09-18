# Add Inbox

A CLI command to easily add Novu's notification inbox component to your React or Next.js project.

## Installation & Usage

You can use this tool without installing it by running:

```bash
npx add-inbox@latest
```

This will guide you through an interactive process to add the Novu Inbox component to your project.

## Features

- ✅ Interactive CLI prompts for selecting framework and TypeScript options
- ✅ Support for React and Next.js
- ✅ Support for Tailwind CSS styling
- ✅ Automatic dependency installation
- ✅ Component creation in your project's component directory
- ✅ Environment variable setup for Novu configuration
- ✅ Custom backend and socket URL configuration
- ✅ Region-based configuration (US/EU)

## Example Usage in Your App

```jsx
import NovuInbox from '@/components/ui/inbox/NovuInbox';

// Inside your component
return (
  <div>
    <header className="flex justify-between items-center">
      <h1>My App</h1>
      <NovuInbox />
    </header>
  </div>
);
```

## Configuration

Make sure to set up your Novu application ID:

For React:
```
NOVU_APP_ID=your_app_id_here
```

For Next.js:
```
NEXT_PUBLIC_NOVU_APP_ID=your_novu_app_id_here
```

## Custom Backend Configuration

When using custom backend and socket URLs, the generated component will include the appropriate props:

```jsx
<Inbox 
  applicationIdentifier={process.env.NEXT_PUBLIC_NOVU_APP_ID}
  subscriberId={subscriberId}
  backendUrl="https://api.my-novu-instance.com"
  socketUrl="wss://ws.my-novu-instance.com"
  // ... other props
/>
```

If no custom URLs are provided, the component will use Novu's default URLs or region-specific URLs (EU region uses `https://eu.api.novu.co` and `wss://eu.ws.novu.co`).
