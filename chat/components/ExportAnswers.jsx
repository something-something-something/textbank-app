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
				<AnswerTable script={script}/>
			)}
		
	</div>);
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
				{props.script.questions.map((el)=>{
					return <td key={el.id}> {el.headerName}</td>;
				})}
			</tr>
		</thead>
		<tbody>
			{props.script.contacts.filter((el)=>{
				return el.completed;
			}).map((el)=>{
				return <AnswerRow script={props.script} contact={el}/>
			})}
		</tbody>
	</table>)
}


function AnswerRow(props){
	return (<tr>
		<td>{props.contact.vanid}</td>
		<td>{props.contact.name}</td>
		{props.script.questions.map((q)=>{
			return (<td key={q.id}>
				{props.contact.answers.filter((el)=>{
					return el.question.id===q.id
				}).map((a)=>{
					return a.answerText
				}).join('\t')}
			</td>);
		})}
	</tr>);
}

