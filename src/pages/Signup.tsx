import React from 'react';
import { SignupForm } from '@/components/auth/SignupForm';

const Signup: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <SignupForm />
    </div>
  );
};

export default Signup;
