import dynamic from 'next/dynamic';

const DynamicExportAnswers=dynamic(async ()=>{
	return (await import('../../components/ExportAnswers')).ExportAnswers
},{ssr:false});
const DynamicNavMenu=dynamic(()=>{
	return  import('../components/NavMenu')
},{ssr:false});
function ExportAnswersPage(){
	return <div>
		<DynamicNavMenu/>
		Edit Scripts
		<DynamicExportAnswers/>
	</div>
}

export default ExportAnswersPage;