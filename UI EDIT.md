# Homepage Design Analysis & Proposal

## User Request
A very simplistic, modern, simple, and neat UI for the homepage (`/`).
- **Theme**: Light, white background.
- **Brand Colors**: Orange-brown (`#ffb36b`) and Black-blue (`#0f172a`).
- **Layout**:
    - **Left**: Photo (`assets/2.png`).
    - **Right**: Catchy text + Large branded button "Let's Go".
- **Navigation**: Homepage (`/`) loads this new UI. "Let's Go" button navigates to `/login`.

## Design Specifications

### Layout
- **Container**: Full viewport height (`min-height: 100vh`), Flexbox or Grid layout.
- **Left Side (Hero Image)**:
    - Display `assets/2.png`.
    - Object-fit: Contain or Cover (depending on image aspect ratio) to look neat.
    - Minimal clutter.
- **Right Side (Call to Action)**:
    - **Headline**: "School Management. Simplified." (or "Bigezo: The Future of School Management").
    - **Subtext**: "Manage students, fees, and communication with ease. Experience power and simplicity in one place."
    - **Button**: Large "Let's Go" button.
        - **Style**: Pill-shaped or Rounded (`border-radius: 50px`).
        - **Color**: Gradient `#ffb36b` to `#ff7a00` (Brand Orange) or `#0078ff` (Brand Blue) for contrast. Given the white background, the Brand Orange gradient stands out warmly.
        - **Hover**: Slight lift/shadow.

### Typography & Colors
- **Background**: `#ffffff` (White).
- **Text Color**: `#0f172a` (Brand Black-blue) for high contrast and readability.
- **Fonts**: `Inter` or `Poppins` (consistent with app).

## Implementation Steps
1.  **Generate Component**: Create `HomeComponent`.
2.  **Asset Check**: Verify `assets/2.png` exists.
3.  **Routing Update**:
    - Change `{ path: '', redirectTo: '/login' }` to `{ path: '', component: HomeComponent }`.
    - Ensure `/login` remains accessible.
