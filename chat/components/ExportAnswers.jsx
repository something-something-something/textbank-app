import {useState,useEffect} from 'react';
import {queryGraphQL} from '../lib/graphql';
import {useRouter} from 'next/router'

export function ExportAnswers(){


	const [script,setScript]=useState(null);
	const router=useRouter();
	let scriptID=router.query.script!==undefined?router.query.script:''
	const fetchData=async ()=>{
		let res=await queryGraphQL(`
			query($sid:ID!){
				Script(where:{id:$sid}){
					id
					name
					questions{
						id
						questionText
						headerName
					}
					contacts{
						id
						name
						vanid
						completed
						doNotContact
						answers{
							id
							answerText
							question{
								id
							}
						}
					}
				}
			}


		`,{
			sid:scriptID
		});
		
		setScript(res.data.Script)
		
	}

	useEffect(()=>{
		if(scriptID!==''){
			fetchData();
		}
	},[scriptID])


	return (
		
		<div>
			{script!==null&&(
				<>
				<DownloadCSVLink script={script}/>
				<AnswerTable script={script}/>
				</>
			)}
		
	</div>);
}
function DownloadCSVLink(props){


	const makeCSV=()=>{
		let userheaders=['vanid','name','doNotContact']
		let questionHeaders=props.script.questions.map((q)=>{
			return q.headerName;
		});

		let fieldRows=props.script.contacts.filter((c)=>{
			return c.completed;
		}).map((c)=>{
			let cells=[c.vanid,c.name,c.doNotContact?'true':'false']
			for(let q of props.script.questions){
				let ca=c.answers.filter((a)=>{
					return a.question.id===q.id;
				});
				if(ca.length!==0){
					cells.push(ca.map((a)=>{
						return a.answerText;	
					}).join('\n\n'));
				}
				else{
					cells.push('')
				}

			}
			return cells;
		});
		let table=[userheaders.concat(questionHeaders)]
		if(fieldRows.length!==0){
			table=table.concat(fieldRows);
		}
		console.log(table);

		let csv=table.map((row)=>{
			return row.map((cell)=>{
				let cellSafe="";
				//avoid injection attack
				let cellIsNotSafe=cell.startsWith('=')||cell.startsWith('+')||cell.startsWith('-')||cell.startsWith('@');
				if(cellIsNotSafe){
					cellSafe=' '+cell;
				}
				else{
					cellSafe=cell;
				}
				return '"'+cellSafe.replaceAll('"','""')+'"'
			}).join(',')
		}).join('\r\n');
		console.log(csv);
		let fname=props.script.name+'-export-results'+'.csv'
		let file=new File([csv],fname,{
			type:'text/csv'
		})
		//console.log(file);
		return file;

	}
	let csvfile=makeCSV();


	return <a download={csvfile.name} href={URL.createObjectURL(csvfile)} >Download CSV</a>
}



function AnswerTable(props){

	// let headers=props.script.questions.map((el)=>{
	// 	return {
	// 		id:el.id,
	// 		headerName:el.headerName
	// 	}
	// })

	return (<table>
		<thead>
			<tr>
				<td>vanid</td>
				<td>name</td>
				<td>Do not Contact</td>
				{props.script.questions.map((el)=>{
					return <td key={el.id}> {el.headerName}</td>;
				})}
				<td>Chat</td>
			</tr>
		</thead>
		<tbody>
			{props.script.contacts.filter((el)=>{
				return el.completed;
			}).map((el)=>{
				return <AnswerRow key={el.id} script={props.script} contact={el}/>
			})}
		</tbody>
	</table>)
}


function AnswerRow(props){
	return (<tr>
		<td>{props.contact.vanid}</td>
		<td>{props.contact.name}</td>
		<td>{props.contact.doNotContact?'true':'false'}</td>
		{props.script.questions.map((q)=>{
			return (<td key={q.id}>
				{props.contact.answers.filter((el)=>{
					return el.question.id===q.id
				}).map((a)=>{
					return a.answerText
				}).join(',')}
			</td>);
		})}
		<td>
			<a href={'/chat?script='+encodeURIComponent(props.script.id)+'&contact='+encodeURIComponent(props.contact.id)}>
				View
			</a> 
		</td>
	</tr>);
}

