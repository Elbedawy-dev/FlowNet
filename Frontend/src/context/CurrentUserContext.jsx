import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  const isMock = Boolean(import.meta.env.DEV && typeof window !== 'undefined' && localStorage.getItem('test_mock_user') === 'true');
  const effectiveSignedIn = isSignedIn || isMock;
  const effectiveUser = useMemo(
    () => clerkUser || (isMock ? { id: 'mock_test_user', fullName: 'Tester FlowNet', username: 'tester' } : null),
    [clerkUser, isMock]
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    if (!effectiveSignedIn) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    if (isMock) {
      setCurrentUser({
        _id: 'mock_test_user',
        full_name: 'FlowNet User',
        username: 'user',
        profile_picture: '',
        bio: 'Exploring FlowNet',
        followers: [],
        following: [],
        connections: [],
        is_verified: true,
      });
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
      if (effectiveUser) {
        setCurrentUser({
          _id: effectiveUser.id,
          full_name: effectiveUser.fullName || effectiveUser.username || 'User',
          username: effectiveUser.username || effectiveUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'user',
          profile_picture: effectiveUser.imageUrl || '',
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
  }, [effectiveSignedIn, effectiveUser, isMock]);

  useEffect(() => {
    if (isAuthLoaded || isMock) {
      fetchCurrentUser();
    }
  }, [isAuthLoaded, isMock, fetchCurrentUser]);

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
