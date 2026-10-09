import axios from 'axios';
import { TOP200_API_URL } from '../newDataConfig';

export async function fetchTop200(team, season, signal) {
  const { data } = await axios.get(TOP200_API_URL, {
    params: { team, season },
    signal
  });
  if (data?.success !== true || !Array.isArray(data.data)) {
    throw new Error('Invalid TOP 200 response');
  }
  return data.data.filter(row => row.team === team && row.season === season).slice(0, 200);
}
