# User Profile Page

## Overview

The user profile page displays comprehensive information about a user, including their statistics, match history, and allows profile editing for the authenticated user viewing their own profile.

## Features

### 1. Profile Header

- Displays user avatar (or initial if no avatar)
- Shows display name and username
- Shows member since date
- Edit profile button (only visible for own profile)

### 2. Profile Editing

- Edit display name
- Edit avatar URL
- Save/Cancel functionality
- Loading state during save

### 3. User Statistics

- Rating
- Wins
- Losses
- Win rate
- Reuses the `UserStats` component

### 4. Rating History (Placeholder)

- Placeholder for future chart implementation
- Will show rating progression over time

### 5. Achievements (Placeholder)

- Placeholder for future achievement system
- Will display earned badges and achievements

### 6. Match History

- Paginated list of matches
- Shows 10 matches per page
- Previous/Next navigation
- Reuses the `MatchHistory` component
- Clicking a match navigates to results page

## Routes

- `/profile/[userId]` - View any user's profile
- Accessible from dashboard via "View Profile" button
- Can view other users' profiles by changing the userId parameter

## API Endpoints Used

- `GET /api/users/:id` - Fetch user profile
- `GET /api/users/:id/stats` - Fetch user statistics
- `GET /api/users/:id/matches` - Fetch user match history (paginated)
- `PATCH /api/users/:id` - Update user profile (own profile only)

## Components

### ProfilePage

Main page component that orchestrates all profile functionality.

**Props:** None (uses URL params)

**State:**

- `user` - User profile data
- `stats` - User statistics
- `matches` - Match history
- `isEditing` - Edit mode flag
- `editForm` - Form data for editing
- `currentPage` - Pagination state

## Testing

Comprehensive test suite covering:

- Profile rendering
- Loading states
- Edit functionality
- Pagination
- Error handling
- Navigation
- Avatar display
- Date formatting

Run tests:

```bash
npm test -- src/app/profile/__tests__/page.test.tsx --run
```

## Future Enhancements

1. **Rating History Chart**

   - Line chart showing rating over time
   - Interactive tooltips
   - Time range filters

2. **Achievement System**

   - Badge display
   - Achievement progress
   - Unlock animations

3. **Advanced Statistics**

   - Win rate by difficulty
   - Favorite languages
   - Average match duration
   - Performance trends

4. **Social Features**
   - Follow/unfollow users
   - Challenge user to match
   - View mutual matches

## Styling

Uses the Phantom design system:

- Dark cyberpunk theme
- Glassmorphism effects
- Neon accent colors (cyan, magenta, lime)
- Smooth transitions and hover effects
- Responsive layout
