import dynamic from 'next/dynamic';

const DynamicScriptControls=dynamic(async ()=>{
	return (await import('../../components/ScriptControls')).ScriptControls
},{ssr:false});

function ScriptControlsPage(){
	return <div>
		Edit Scripts
		<DynamicScriptControls/>
	</div>
}

export default ScriptControlsPage;