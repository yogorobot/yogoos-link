# GEMINI.md - Your AI Assistant's Guide to this Project

## Project Overview

This project is a desktop application built with Electron, React, and TypeScript. It serves as an SSH client with advanced features designed for developers, including:

*   **SSH Connection Management:** Connect to SSH servers directly or through a jump host.
*   **Remote Debugging:** Tools for debugging applications running on remote servers.
*   **Log Viewing:** Real-time and historical log viewing capabilities.
*   **SSH Tunneling:** Create and manage SSH tunnels.

The application is based on the Electron React Boilerplate, which provides a solid foundation for building cross-platform desktop apps.

## Building and Running

### Prerequisites

*   Node.js and npm (check `package.json` for version requirements)

### Development

To run the application in a development environment with hot-reloading:

```bash
npm start
```

### Building for Production

To package the application for your local platform:

```bash
npm run package
```

This will create a distributable application in the `release/build` directory.

### Testing

To run the test suite:

```bash
npm test
```

## Development Conventions

*   **Languages:** TypeScript is used for both the main and renderer processes.
*   **Styling:** SCSS is used for styling, with CSS Modules for component-level styles.
*   **Linting:** ESLint is configured to enforce a consistent coding style. Run `npm run lint` to check for linting errors.
*   **State Management:** The application uses React hooks for state management.
*   **Inter-Process Communication (IPC):** The main and renderer processes communicate using Electron's IPC modules. Events are defined in `src/main/events/index.ts`.

## Project Structure

*   `.erb/`: Contains configuration files for Webpack, scripts, and other settings related to the Electron React Boilerplate build system.
*   `src/`: The main source code directory.
    *   `main/`: Contains the code for the Electron main process. This is where the application's lifecycle is managed, and where Node.js APIs can be used.
        *   `main.ts`: The entry point for the main process.
        *   `managers/`: Contains manager modules for handling specific functionalities like SSH connections (`ssh.ts`) and window management (`window.ts`).
    *   `renderer/`: Contains the code for the Electron renderer process, which is the user interface of the application.
        *   `App.tsx`: The main React component that sets up the application's routing.
        *   `index.tsx`: The entry point for the renderer process.
        *   `pages/`: Contains the different pages of the application, such as the login screen and the remote debugging view.
        *   `components/`: Contains reusable React components.
        *   `hooks/`: Contains custom React hooks for managing state and side effects.
*   `release/`: Contains the packaged application and build output.
