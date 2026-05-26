'use client';

import React, { useEffect } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { fetchCurrentUser } from '@/lib/api';
import { clearSession, getDashboardPath, getToken, resolveDashboardType } from '@/lib/authSession';

const Dashboard: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    fetchCurrentUser()
      .then((user) => {
        router.replace(getDashboardPath(resolveDashboardType(user)));
      })
      .catch(() => {
        clearSession();
        router.replace('/login');
      });
  }, [router]);

  return null;
};

export default Dashboard;
