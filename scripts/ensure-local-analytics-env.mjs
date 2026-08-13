#!/usr/bin/env node
import localEnv from './lib/local-env.cjs';

localEnv.ensureLocalAnalyticsHashSecret('.living-system-map/runtime-analytics.local');
