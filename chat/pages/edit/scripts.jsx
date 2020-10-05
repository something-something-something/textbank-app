import dynamic from 'next/dynamic';

const DynamicScriptControls=dynamic(async ()=>{
	return (await import('../../components/ScriptControls')).ScriptControls
},{ssr:false});
const DynamicNavMenu=dynamic(()=>{
	return  import('../../components/NavMenu')
},{ssr:false});


function ScriptControlsPage(){
	return <div>
		<DynamicNavMenu/>
		Edit Scripts
		<DynamicScriptControls/>
	</div>
}

export default ScriptControlsPage;