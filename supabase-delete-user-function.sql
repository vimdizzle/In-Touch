-- Function to delete a user from auth.users
-- This function requires SECURITY DEFINER to have permission to delete from auth.users
-- Security: Users can only delete their own account (enforced by checking auth.uid())

CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  current_user_id := auth.uid();
  
  -- Security check: Only allow users to delete their own account
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Delete from auth.users (only the current user's account)
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_auth_user() TO authenticated;

