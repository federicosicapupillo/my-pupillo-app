import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const enabled = process.env['RUN_DB_TESTS'] === '1' && !!url && !!key;

(enabled ? describe : describe.skip)('persisted review stars', () => {
  const admin = createClient(url || 'http://localhost', key || 'unused', {
    auth: { persistSession: false },
  });
  const users: string[] = [];
  let worker = '';
  let restaurant = '';

  beforeAll(async () => {
    for (const role of ['worker', 'restaurant']) {
      const { data, error } = await admin.auth.admin.createUser({
        email: `review-stars-${role}-${crypto.randomUUID()}@example.com`,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { role },
      });
      if (error || !data.user) throw new Error('Cannot create isolated review fixture');
      users.push(data.user.id);
      const { error: roleError } = await admin.from('user_roles').upsert(
        { user_id: data.user.id, role }, { onConflict: 'user_id,role' },
      );
      if (roleError) throw new Error(roleError.message);
      if (role === 'worker') worker = data.user.id;
      else restaurant = data.user.id;
    }
  });

  afterAll(async () => {
    for (const id of users) {
      for (const [table, column] of [
        ['reviews', 'author_id'], ['notifications', 'user_id'],
        ['activity_logs', 'user_id'], ['user_roles', 'user_id'], ['profiles', 'id'],
      ]) {
        const { error } = await admin.from(table).delete().eq(column, id);
        if (error) throw new Error(`Review fixture cleanup failed: ${table}`);
      }
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error('Review fixture auth cleanup failed');
    }
  });

  it.each([2, 4, 5])('keeps the worker-selected %i stars despite different detail scores', async (rating) => {
    const { data, error } = await admin.from('reviews').insert({
      author_id: worker, target_id: restaurant, rating,
      // No supplied direction: the earlier compute trigger must resolve roles.
      communication: 1, professionalism: 1, reliability: 1, staff_collaboration: 1,
    }).select('id,rating,direction').single();
    expect(error).toBeNull();
    expect(data?.rating).toBe(rating);
    expect(data?.direction).toBe('worker_to_restaurant');
    const { data: persisted } = await admin.from('reviews').select('rating').eq('id', data?.id).single();
    expect(persisted?.rating).toBe(rating);
    const { data: profile } = await admin.from('profiles').select('rating_avg,reviews_count').eq('id', restaurant).single();
    const { data: reviews } = await admin.from('reviews').select('rating').eq('target_id', restaurant);
    const ratings = reviews?.map((r) => r.rating) || [];
    const average = Math.round(ratings.reduce((sum, n) => sum + n, 0) / ratings.length * 100) / 100;
    expect(Number(profile?.rating_avg)).toBe(average);
    expect(profile?.reviews_count).toBe(ratings.length);
  });

  it('keeps the restaurant five-criterion average instead of the submitted rating', async () => {
    const { data, error } = await admin.from('reviews').insert({
      author_id: restaurant, target_id: worker, rating: 1,
      punctuality: 5, professionalism: 5, competence: 2, reliability: 2, teamwork: 5,
    }).select('rating,direction').single();
    expect(error).toBeNull();
    expect(data?.rating).toBe(4);
    expect(data?.direction).toBe('restaurant_to_worker');
  });
});