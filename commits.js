const express = require("express");
const router = express.Router();
const {Op, Sequelize} = require("sequelize");
const db = require("../models");
const Commits = db.commits;
const Users = db.users;
const Products = db.products;
const Alarms = db.alarms;
const generateCommitTree =  require("../utils/generateCommitTree");
const sendFCM = require("../utils/sendPush");
/**
 * 댓글 등록하기
 * 현재는 본인이 올린 공구에 대한 댓글 및 답글쓰기가 가능하도록 구현됨
 * 현재 진행중인 공구에 대해서만 댓글, 답글이 가능
 */
router.all("/add", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, req.body, ' = 댓글 등록하기 ');
        let msg = [];
        if ( !req.body.product_id )
            msg.push('공구를 선택하세요');
        if ( !req.body.contents )
            msg.push('댓글내용을 입력하세요');
        if ( msg.length > 0 )
            return res.status(200).json({ status: false, msg: msg });

        let temp = await Products.findOne({
            where: {
                id: Number( req.body.product_id ),
                active_state: true,
                deleted: null,
                // state: 1,           //진행중에 있는 공구 필터하기
                active_state: true, // 관리자에 의하여 비노출상태인지 체크하기
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['타당하지 않은 공구에 대한 요청입니다']});

        let buf_exit;
        if ( req.body.parent_id ) {
            buf_exit = await Commits.findOne({
                where: {
                    parent_id: req.body.parent_id.toString(),
                    deleted: null,
                }
            });
            if ( !buf_exit )
                return res.status(200).json({ status: false, msg: ['존재하지 않는 댓글에 대한 타당치 않은 요청입니다']});
            else if ( !buf_exit.active_state )
                return res.status(200).json({ status: false, msg: ['관리자분에 의해 비노출상태에 있는 댓글입니다']});
        }

        let parent_id = req.body.parent_id ? req.body.parent_id.toString() + "." : "";
        let commit = await Commits.create({
            user_id: req.body.jwt_data.id,
            product_id: Number( req.body.product_id ),
            contents: req.body.contents,
            created: new Date().toUTCString(),
        });

        await Commits.update({
            parent_id: parent_id + '00' + commit.id.toString(),
            level: parent_id.split('.').length,
        }, {
            where: {
                id: commit.id,
            }
        });
        // let temp_commit = await Commits.findOne({
        //     where: {
        //         id: commit.id,
        //     }
        // });
        let buf = await Commits.findAll({
            where: {
                product_id: Number( req.body.product_id ),
                // parent_id: { [ Op.like ]: req.body.parent_id.toString() + "%" },  // child 아이디리스트 얻기
                deleted: null,
                active_state: true,
            },
            include: [{
                as: "users",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'name', 'nickname', 'thumbnail', ]
            }],
            order: [['level', 'DESC']],
            attributes: [
                'id', 'user_id', 'product_id', 'parent_id', 'level', 'contents', 'created', 'active_state',
            ]
        });
        let tree = await generateCommitTree( buf );

        /** 댓글/답글알람보내기 **/
        let title = "[" + (temp.product_role === "product" ? "공구마켓" : "함께해요" ) + "] " + ( temp.product_role === "together" ? temp.details : temp.name );
        let content = req.body.jwt_data.nickname + "님이 " + ( req.body.parent_id ? "답글을 달았어요." : "댓글을 달았어요." );
        let user_id = !req.body.parent_id ? temp.user_id : buf_exit.user_id;
        let token;
        if ( !user_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
        let sale_user = await Users.findOne({
            where: {
                id: Number( user_id ),
                deleted: null,
            },
            attributes: [ 'push_token', 'comment_notification' ],
        });
        if ( sale_user.comment_notification )
        {
            token = sale_user.push_token;
            await Alarms.create({
                user_id: user_id,
                product_role: temp.product_role,
                product_id: Number( req.body.product_id ),
                contents: content,
                title: title,
                created: new Date().toUTCString(),
            });
            if ( token ) {
                const push_message = {
                    type: "COMMIT",
                    title: title,
                    body: content,
                    product_role: temp.product_role,
                    product_id: Number( req.body.product_id ),
                    user_id: user_id,
                    token: [ token ],
                };
                await sendFCM(push_message);
            }
        }

        // return res.status(200).json({ status: true, msg: ['댓글이 성공적으로 등록되었습니다'], results: temp_commit });
        return res.status(200).json({ status: true, msg: ['댓글이 성공적으로 등록되었습니다'], list: tree.results });

    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/**
 * 댓글 업뎃하기
 * 본인 작성글인 경우에만 업뎃가능
 */
router.all("/update", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, ' = 댓글 업뎃하기 ');
        if ( !req.body.parent_id )
            return res.status(200).json({ status: false, msg: ['업뎃하려는 댓글을 선택하세요']});
        else if ( !req.body.contents )
            return res.status(200).json({ status: false, msg: ['댓글내용을 입력하세요']});

        let commit = await Commits.findOne({
            where: {
                parent_id: req.body.parent_id,
                deleted: null,
            }
        });
        if ( !commit )
            return res.status(200).json({ status: false, msg: ['선택된 댓글은 존재하지 않습니다']});
        else if ( !commit.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의해 비노출상태에 있는 댓글입니다']});

        await Commits.update({
            contents: req.body.contents,
            updated: new Date().toUTCString(),
        }, {
            where: {
                parent_id: req.body.parent_id,
                deleted: null,
            }
        });

        let buf = await Commits.findAll({
            where: {
                product_id: Number( commit.product_id ),
                deleted: null,
                active_state: true,
            },
            include: [{
                as: "users",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'name', 'nickname', 'thumbnail', ]
            }],
            order: [['level', 'DESC']],
            attributes: [
                'id', 'user_id', 'product_id', 'parent_id', 'level', 'contents', 'created', 'active_state',
            ]
        });

        let tree = await generateCommitTree( buf );

        // let temp_commit = await Commits.findOne({
        //     where: {
        //         parent_id: req.body.parent_id,
        //         deleted: null,
        //     }
        // });

        // return res.status(200).json({ status: true, msg: ['댓글이 성공적으로 업뎃되었습니다'], results: temp_commit });
        return res.status(200).json({ status: true, msg: ['댓글이 성공적으로 업뎃되었습니다'], results: tree.results });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/**
 * 댓글 삭제하기
 * 본인 작성글인 경우에만 삭제가능
 */
router.all("/delete", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, ' = 댓글 삭제하기 ');
        if ( !req.body.parent_id )
            return res.status(200).json({ status: false, msg: ['삭제하려는 댓글을 선택하세요']});

        let commit = await Commits.findOne({
            where: {
                parent_id: req.body.parent_id,
                deleted: null,
            }
        });
        if ( !commit )
            return res.status(200).json({ status: false, msg: ['선택된 댓글은 존재하지 않습니다']});
        else if ( !commit.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의해 비노출상태에 있는 댓글입니다']});

        // await Commits.update({
        //     deleted: new Date().toUTCString(),
        // }, {
        //     where: {
        //         parent_id: req.body.parent_id,
        //         deleted: null,
        //     }
        // });
        await Commits.destroy({
            where: {
                parent_id:{ [Op.like]: req.body.parent_id + "%" },
                deleted: null,
            }
        });
        let buf = await Commits.findAll({
            where: {
                product_id: Number( commit.product_id ),
                deleted: null,
                active_state: true,
            },
            include: [{
                as: "users",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'name', 'nickname', 'thumbnail', ]
            }],
            order: [['level', 'DESC']],
            attributes: [
                'id', 'user_id', 'product_id', 'parent_id', 'level', 'contents', 'created', 'active_state',
            ]
        });

        let tree = await generateCommitTree( buf );

        return res.status(200).json({ status: true, msg: ['댓글이 성공적으로 삭제되었습니다'], results: tree.results });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/**
 * 공구별 댓글 리스트 얻기
 */
router.all("/get-list", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, req.body.product_id, " = 댓글 리스트 얻기 " );
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['공구를 선택하세요']});

        let buf = await Commits.findAll({
            where: {
                product_id: Number( req.body.product_id ),  // child 아이디리스트 얻기
                deleted: null,
                active_state: true,
            },
            include: [{
                as: "users",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'name', 'nickname', 'thumbnail', ]
            }],
            order: [['level', 'DESC']],
            attributes: [
                'id', 'user_id', 'product_id', 'parent_id', 'level', 'contents', 'created', 'active_state',
            ]
        });

        let tree = await generateCommitTree( buf );

        return res.status(200).json({ status: true, results: tree.results });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] });
    }
});


/**
 * 공구별 답글 리스트 얻기
 */
router.all("/get-commits", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, req.body.product_id, " = 댓글 리스트 얻기 " );
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['공구를 선택하세요']});
        if ( !req.body.parent_id )
            return res.status(200).json({ status: false, msg: ['댓글을 선택하세요']});

        let tmp = await Commits.findOne({
            where: {
                product_id: Number( req.body.product_id ),  // child 아이디리스트 얻기
                deleted: null,
                active_state: true,
                parent_id: req.body.parent_id,
            }
        });
        if ( !tmp )
            return res.status(200).json({ status: false, msg: ['요청하신 댓글은 존재하지 않습니다.']});

        let data = await Commits.findAll({
            where: {
                product_id: Number( req.body.product_id ),  // child 아이디리스트 얻기
                deleted: null,
                active_state: true,
            },
            include: [{
                as: "users",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'name', 'nickname', 'thumbnail', ]
            }],
            order: [['level', 'DESC']],
            attributes: [
                'id', 'user_id', 'product_id', 'parent_id', 'level', 'contents', 'created', 'active_state',
            ]
        });

        data = data.filter( item => item['dataValues'].parent_id.includes( req.body.parent_id ) === true );
        let list = data;
        if ( data.length === 0 )
            return res.status(200).json({ status: false, results: [] });

        while ( list[ 0 ].level !== tmp.level ) {
            let temp = list[ 0 ]['dataValues'].parent_id;
            let buf = temp.split('.');
            let parent_temp = "";

            for ( let i = 0; i < buf.length - 1; i ++ ) {
                parent_temp += buf[ i ];
                if ( i !== buf.length - 2 )
                    parent_temp += "."
            }
            for ( let i = 1; i < list.length; i ++ ) {
                if ( list[ i ]['dataValues'].parent_id === parent_temp ) {
                    if ( !list[ i ]['dataValues'].children ) {
                        list[ i ]['dataValues'] = Object.assign( {}, list[ i ]['dataValues'], { children: [list[ 0 ]] });
                    } else {
                        let children = list[ i ]['dataValues'].children;
                        children.push( list[ 0 ] );
                        children.sort( (a, b) => {
                            return a.created - b.created;
                        });
                        list[ i ]['dataValues'].children = children;
                    }
                    break;
                }
            }
            list.shift();
        }
        list.sort( (a, b ) => { return b.created - a.created } );
        return res.status(200).json({ status: true, results: list });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] });
    }
});

module.exports = router;