import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    console.log('Starting player enrichment sync...');
    
    // Fetch all enrichment data
    const [decompResponse, skillsResponse, approachResponse] = await Promise.all([
      fetch(`https://feeds.datagolf.com/preds/player-decompositions?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/preds/skill-ratings?file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/preds/approach-skill?period=l24&file_format=json&key=${process.env.DATAGOLF_API_KEY}`)
    ]);
    
    const decompData = await decompResponse.json();
    const skillsData = await skillsResponse.json();
    const approachData = await approachResponse.json();
    
    console.log(`Processing ${decompData.players?.length || 0} players...`);
    
    let synced = 0;
    let errors = 0;
    
    // Process each player in the current tournament field
    for (const player of decompData.players || []) {
      try {
        const skills = skillsData.players?.find((p: any) => p.dg_id === player.dg_id);
        const approach = approachData.data?.find((p: any) => p.dg_id === player.dg_id);
        
        // Upsert player enrichment data
        await query(`
          INSERT INTO player_enrichment_cache (
            dg_id,
            player_name,
            baseline_pred,
            final_pred,
            course_history_adjustment,
            course_fit_adjustment,
            age_adjustment,
            sg_ott,
            sg_app,
            sg_arg,
            sg_putt,
            sg_total,
            driving_acc,
            driving_dist,
            approach_150_200_fw_sg,
            approach_150_200_fw_proximity,
            approach_over_200_fw_sg,
            decomposition_json,
            skills_json,
            approach_json,
            last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
          ON CONFLICT (dg_id) 
          DO UPDATE SET
            player_name = EXCLUDED.player_name,
            baseline_pred = EXCLUDED.baseline_pred,
            final_pred = EXCLUDED.final_pred,
            course_history_adjustment = EXCLUDED.course_history_adjustment,
            course_fit_adjustment = EXCLUDED.course_fit_adjustment,
            age_adjustment = EXCLUDED.age_adjustment,
            sg_ott = EXCLUDED.sg_ott,
            sg_app = EXCLUDED.sg_app,
            sg_arg = EXCLUDED.sg_arg,
            sg_putt = EXCLUDED.sg_putt,
            sg_total = EXCLUDED.sg_total,
            driving_acc = EXCLUDED.driving_acc,
            driving_dist = EXCLUDED.driving_dist,
            approach_150_200_fw_sg = EXCLUDED.approach_150_200_fw_sg,
            approach_150_200_fw_proximity = EXCLUDED.approach_150_200_fw_proximity,
            approach_over_200_fw_sg = EXCLUDED.approach_over_200_fw_sg,
            decomposition_json = EXCLUDED.decomposition_json,
            skills_json = EXCLUDED.skills_json,
            approach_json = EXCLUDED.approach_json,
            last_updated = NOW()
        `, [
          player.dg_id,
          player.player_name,
          player.baseline_pred,
          player.final_pred,
          player.total_course_history_adjustment,
          player.total_fit_adjustment,
          player.age_adjustment,
          skills?.sg_ott || null,
          skills?.sg_app || null,
          skills?.sg_arg || null,
          skills?.sg_putt || null,
          skills?.sg_total || null,
          skills?.driving_acc || null,
          skills?.driving_dist || null,
          approach?.['150_200_fw_sg_per_shot'] || null,
          approach?.['150_200_fw_proximity_per_shot'] || null,
          approach?.['over_200_fw_sg_per_shot'] || null,
          JSON.stringify(player),
          JSON.stringify(skills || {}),
          JSON.stringify(approach || {})
        ]);
        
        synced++;
      } catch (error) {
        console.error(`Error syncing player ${player.dg_id}:`, error);
        errors++;
      }
    }
    
    return NextResponse.json({
      success: true,
      synced,
      errors,
      event_name: decompData.event_name,
      course_name: decompData.course_name,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync enrichment data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}