/**
 * PREPAREDNESS PLAN ROUTES
 * Handles preparedness plan generation and retrieval
 * Cost optimization: Centralized AI plans for users with similar profiles
 */

import express from 'express';
import { centralizedPreparednessPlanService } from '../services/centralizedPreparednessPlanService';

const router = express.Router();

interface PlanParams {
  familySize?: number;
  hasPets?: boolean;
  hasChildren?: boolean;
  hasElderly?: boolean;
  hasDisabilities?: boolean;
  locationName?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  residenceType?: string;
}

/**
 * POST /api/preparedness/generate
 * Generate or retrieve AI preparedness plan for a user profile
 * Cost optimization: One plan per profile type shared by all users
 */
router.post('/generate', async (req, res) => {
  try {
    const params: PlanParams = req.body;

    if (!params) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan parameters',
      });
    }

    const plan = await centralizedPreparednessPlanService.getOrGeneratePlan(params);

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Failed to generate preparedness plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate plan',
    });
  }
});

export default router;

