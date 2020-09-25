import dynamic from 'next/dynamic';

const DynamicExportAnswers=dynamic(async ()=>{
	return (await import('../../components/ExportAnswers')).ExportAnswers
},{ssr:false});

function ExportAnswersPage(){
	return <div>
		Edit Scripts
		<DynamicExportAnswers/>
	</div>
}

export default ExportAnswersPage;