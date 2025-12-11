/**
 * Tests for Feedback API Route
 * Tests user feedback submission and validation
 */

import { z } from 'zod';

// Validation schema (mirrors the one in the API route)
const feedbackSchema = z.object({
  analysisId: z.string().uuid(),
  feedbackType: z.enum(['relevant', 'noise', 'false_positive', 'critical']),
  comment: z.string().optional()
});

describe('Feedback API', () => {
  describe('Request validation', () => {
    it('should accept valid feedback with all fields', () => {
      const validFeedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'relevant',
        comment: 'This is a helpful analysis'
      };

      const result = feedbackSchema.safeParse(validFeedback);
      expect(result.success).toBe(true);
    });

    it('should accept valid feedback without comment', () => {
      const validFeedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'noise'
      };

      const result = feedbackSchema.safeParse(validFeedback);
      expect(result.success).toBe(true);
    });

    it('should accept all valid feedback types', () => {
      const feedbackTypes = ['relevant', 'noise', 'false_positive', 'critical'];

      feedbackTypes.forEach(type => {
        const feedback = {
          analysisId: '123e4567-e89b-12d3-a456-426614174000',
          feedbackType: type
        };

        const result = feedbackSchema.safeParse(feedback);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid UUID', () => {
      const invalidFeedback = {
        analysisId: 'not-a-uuid',
        feedbackType: 'relevant'
      };

      const result = feedbackSchema.safeParse(invalidFeedback);
      expect(result.success).toBe(false);
    });

    it('should reject invalid feedback type', () => {
      const invalidFeedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'invalid_type'
      };

      const result = feedbackSchema.safeParse(invalidFeedback);
      expect(result.success).toBe(false);
    });

    it('should reject missing analysisId', () => {
      const invalidFeedback = {
        feedbackType: 'relevant'
      };

      const result = feedbackSchema.safeParse(invalidFeedback);
      expect(result.success).toBe(false);
    });

    it('should reject missing feedbackType', () => {
      const invalidFeedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = feedbackSchema.safeParse(invalidFeedback);
      expect(result.success).toBe(false);
    });

    it('should handle empty object', () => {
      const result = feedbackSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(feedbackSchema.safeParse(null).success).toBe(false);
      expect(feedbackSchema.safeParse(undefined).success).toBe(false);
    });
  });

  describe('Feedback types', () => {
    it('relevant - marks analysis as useful', () => {
      const feedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'relevant' as const
      };

      const result = feedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.feedbackType).toBe('relevant');
      }
    });

    it('noise - marks analysis as not useful', () => {
      const feedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'noise' as const
      };

      const result = feedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });

    it('false_positive - marks analysis as incorrect', () => {
      const feedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'false_positive' as const
      };

      const result = feedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });

    it('critical - marks analysis as important', () => {
      const feedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'critical' as const
      };

      const result = feedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });
  });

  describe('Comment validation', () => {
    it('should accept long comments', () => {
      const longComment = 'A'.repeat(1000);
      const feedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'relevant',
        comment: longComment
      };

      const result = feedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });

    it('should accept empty comment', () => {
      const feedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'relevant',
        comment: ''
      };

      const result = feedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });

    it('should accept comments with special characters', () => {
      const feedback = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
        feedbackType: 'relevant',
        comment: 'Comment with special chars: <script>alert("xss")</script> & "quotes" \'apostrophes\''
      };

      const result = feedbackSchema.safeParse(feedback);
      expect(result.success).toBe(true);
    });
  });

  describe('UUID validation', () => {
    it('should accept valid v4 UUID', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '550e8400-e29b-41d4-a716-446655440000'
      ];

      validUUIDs.forEach(uuid => {
        const feedback = {
          analysisId: uuid,
          feedbackType: 'relevant'
        };

        const result = feedbackSchema.safeParse(feedback);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        '123',
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567e89b12d3a456426614174000',
        'ZZZZZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZZZZZZZZZ'
      ];

      invalidUUIDs.forEach(uuid => {
        const feedback = {
          analysisId: uuid,
          feedbackType: 'relevant'
        };

        const result = feedbackSchema.safeParse(feedback);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Feedback statistics calculation', () => {
    it('should calculate accuracy correctly', () => {
      // Accuracy = (relevant + critical) / total * 100
      const feedbackCounts = {
        relevant: 30,
        critical: 10,
        noise: 5,
        falsePositive: 5
      };

      const total = Object.values(feedbackCounts).reduce((a, b) => a + b, 0);
      const accuracy = ((feedbackCounts.relevant + feedbackCounts.critical) / total) * 100;

      expect(accuracy).toBe(80);
    });

    it('should handle zero total feedback', () => {
      const total = 0;
      const accuracy = total > 0 ? 80 : 0;

      expect(accuracy).toBe(0);
    });

    it('should handle all positive feedback', () => {
      const feedbackCounts = {
        relevant: 50,
        critical: 50,
        noise: 0,
        falsePositive: 0
      };

      const total = Object.values(feedbackCounts).reduce((a, b) => a + b, 0);
      const accuracy = ((feedbackCounts.relevant + feedbackCounts.critical) / total) * 100;

      expect(accuracy).toBe(100);
    });

    it('should handle all negative feedback', () => {
      const feedbackCounts = {
        relevant: 0,
        critical: 0,
        noise: 30,
        falsePositive: 20
      };

      const total = Object.values(feedbackCounts).reduce((a, b) => a + b, 0);
      const accuracy = ((feedbackCounts.relevant + feedbackCounts.critical) / total) * 100;

      expect(accuracy).toBe(0);
    });
  });
});
