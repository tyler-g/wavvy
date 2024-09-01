import { useShallow } from 'zustand/react/shallow';
import useMixerStore from '../stores/Mixer';

import meterImage from '../assets/vu.jpg';
import './MasterMeter.css';

function MasterMeter() {
  console.log('MasterMeter render');
  //re-renders the component only when db changes
  const [db] = useMixerStore(useShallow((state) => [state.master.db]));

  // computed
  const dbRounded = Math.round(db);
  const degree = dbRounded + 78;

  return (
    <>
      <div className="master-meter">
        <img src={meterImage} alt="meter"></img>
        <div
          className="meter-needle"
          style={{ transform: `rotate(${degree}deg)` }}
        ></div>

        <p>{dbRounded} db</p>
      </div>
    </>
  );
}

export default MasterMeter;
