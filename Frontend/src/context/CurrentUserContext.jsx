import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { usersApi } from '../api/axios';

const CurrentUserContext = createContext({
  currentUser: null,
  loading: true,
  refreshUser: async () => {},
  setCurrentUser: () => {},
});

export const CurrentUserProvider = ({ children }) => {
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    if (!isSignedIn) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userDoc = await usersApi.getMe();
      setCurrentUser(userDoc);
    } catch (err) {
      console.warn('[CurrentUser] Failed to fetch user from backend:', err.message);
      // Fallback object while initial sync happens
      if (clerkUser) {
        setCurrentUser({
          _id: clerkUser.id,
          full_name: clerkUser.fullName || clerkUser.username || 'User',
          username: clerkUser.username || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'user',
          profile_picture: clerkUser.imageUrl || '',
          bio: 'Hey there! I am using flowNet',
          location: '',
          followers: [],
          following: [],
          connections: [],
          is_verified: true,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, clerkUser]);

  useEffect(() => {
    if (isAuthLoaded) {
      fetchCurrentUser();
    }
  }, [isAuthLoaded, fetchCurrentUser]);

  return (
    <CurrentUserContext.Provider
      value={{
        currentUser,
        loading: !isAuthLoaded || loading,
        refreshUser: fetchCurrentUser,
        setCurrentUser,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
};

export const useCurrentUser = () => useContext(CurrentUserContext);
export default CurrentUserContext;
