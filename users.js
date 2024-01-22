const express = require("express");
const router = express.Router();
const {Op, Sequelize} = require("sequelize");
const sharp = require('sharp');

const db = require("../models");
const Users = db.users;
const Products = db.products;
const ProductContents = db.productContents;
const ProductHistories = db.productHistories;
const SalesHistories = db.salesHistories;
const Togethers = db.togethers;
const Points = db.points;
const Angcols = db.angcols;
const Commits = db.commits;
const Favorites = db.favorites;
const Invites = db.invites;
const generateSecurityToken = require("../utils/generateToken");

/**
 * 자동로그인하기
 */
router.all("/auto-login", async ( req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 자동로그인");

        let token = await generateSecurityToken( req.body.jwt_data );
        if (token.status === false) {
            return res.status(200).json({status: false, msg: [ token.flag ]});
        } else {
            const user = await Users.findOne({
                where: { phone: req.body.jwt_data.phone, nickname: req.body.jwt_data.nickname }
            });
            const temp = Object.assign({}, user['dataValues'], { token: token.result });
            return res.status(200).json({ status: true, results: temp, msg: ['로그인이 성공하였습니다'] });
        }
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
} );
/**
 * push_token 업뎃하기
 */
router.all("/update-push-token", async (req, res) => {
    try {
        await Users.update({
            push_token: req.body.push_token,
        }, {
            where: {
                id: req.body.jwt_data.id,
                deleted: null,
            }
        });
        return res.status(200).json({status: true, msg: ['푸시토큰의 업뎃이 성공하였습니다']})
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});
/**
 * 알람설정하기
 */
router.all("/update-alarms", async (req, res) => {
    try {
        console.log( req.body, " = 알람설정하기 " );
        let temp = {
            comment_notification: req.body.comment_notification,
            angol_notification: req.body.angol_notification,
            tool_notification: req.body.tool_notification,
            delivery_notification: req.body.delivery_notification,
            updated: new Date().toUTCString(),
        };

        await Users.update(
            temp,
            {
                where: {
                    id: req.body.jwt_data.id
                }
            }
        );
        return res.status(200).json({ status: true, msg: [ '알람설정이 성공하였습니다' ]});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});
/**
 * 마이 프로필 상세정보 얻기
 */
router.all("/my-profile", async ( req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 마이 프로필 상세정보 얻기 ");
        let temp = await Users.findOne({
            where: {
                id: req.body.jwt_data.id,
                deleted: null,
            }
        });
        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/**
 * 프로필 업뎃하기
 */
router.all("/update-profile", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 프로필업뎃하기 " );
        if ( !req.body.name || !req.body.nickname )
            return res.status(200).json({ status: false, msg: [ '이름과 닉네임을 정확하게 입력하세요' ] });
        let temp_nickname = await Users.findAll({
            where: {
                id: { [Op.ne]: req.body.jwt_data.id },
                nickname: req.body.nickname,
            },
        });
        if ( temp_nickname && temp_nickname.length > 0 )
            return res.status(200).json({ status: false, msg: ['중복된 닉네임입니다']});

        let thumbnail;
        if ( req.body.photo ) {
            let temp = req.body.photo.replace( "docs/", "" );
            thumbnail = 'docs/' + 'thumbnails-' + Date.now() + temp;
            sharp('public/' + req.body.photo).resize(128, 128).toFile( "public/" + thumbnail, (err, resizeImage) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(resizeImage);
                }
            });
        }
        await Users.update({
            name: req.body.name,
            nickname: req.body.nickname,
            photo: req.body.photo ? req.body.photo : null,
            thumbnail: thumbnail ? thumbnail : null,
            updated: new Date().toUTCString(),
        }, {
            where: {
                id: req.body.jwt_data.id,
            }
        });

        return res.status(200).json({ status: true, msg: ['프로필이 성공적으로 업뎃되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});
/**
 * 홈화면에서 주소업뎃하기
 */
router.all( "/update-address", async ( req, res ) => {
    try {
        console.log( req.body, " = 홈화면에서 주소수정 " );
        let valid_msg = [];
        if ( !req.body.address )
            valid_msg.push('주소를 정확하게 입력하세요');
        if ( !req.body.address_detail )
            valid_msg.push('상세주소를 정확하게 입력하세요');
        if ( !req.body.latitude )
            valid_msg.push( '위도를 정확하게 선택해주세요' );
        if ( !req.body.longitude )
            valid_msg.push( '경도를 정확하게 선택해주세요' );

        if ( valid_msg.length > 0 )
            return res.status(200).json({ status: false, msg: valid_msg });
        await Users.update({
            address: req.body.address,
            address_detail: req.body.address_detail,
            longitude: req.body.longitude,
            latitude: req.body.latitude,
            updated: new Date().toUTCString(),
        }, {
            where: { id: req.body.jwt_data.id }
        });
        return res.status(200).json({ status: true, msg: [ '주소가 성공적으로 업뎃되었습니다' ] });
    } catch (e) {
        return res.status(200).json( { status: false, msg: [ e.toString() ] } );
    }
});

/*******************************************************************************************************
 * * * * * * * * * * * * * *                  더 보기                * * * * * * * * * * * * * * * * * *
 *******************************************************************************************************/
/**
 * 나의 판매내역, 구매내역, 함께해요
 */
router.all( "/my-counts", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 나의 판매내역, 구매내역, 함께 해요 " );
        // 판매내역
        let sales = await Products.count({
            where: {
                product_role: "product",
                user_id: req.body.jwt_data.id,
                deleted: null,
                state: {[Op.in]: [1, 2, 3, 4, 5]},
                active_state: true,
            }
        });
        // 구매내역
        let purchase = await SalesHistories.count({
            where: {
                user_id: req.body.jwt_data.id,
            }
        });
        // 함께해요
        // 내가 올린 이야기
        let togethers = await Products.count({
            where: {
                product_role: "together",
                user_id: req.body.jwt_data.id,
                deleted: null,
                active_state: true,
            }
        });
        // 내가 참여한 이야기
        let togethers1 = await Togethers.count({
            where: {
                user_id: req.body.jwt_data.id,
            }
        });
        togethers += togethers1;

        let user = await Users.findOne({
            where: { id: req.body.jwt_data.id }
        });

        let temp = {
            sales: sales,
            purchase: purchase,
            togethers: togethers,
            points:user['dataValues'].points
        };
        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});

/**
 * 내 포인트내역
 */
router.all( "/my-points", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 내 포인트내역 " );
        // 적립 포인트내역
        let received = await Points.findAll({
            where: {
                user_id: req.body.jwt_data.id,
                type: "received",
            },
            order: [['created', 'DESC']],
            attributes: ["product_name", 'amount', 'created']
        });
        let used = await Points.findAll({
            where: {
                user_id: req.body.jwt_data.id,
                type: "used",
            },
            order: [['created', 'DESC']],
            attributes: ['product_name', 'amount', 'created']
        });
        let temp = {
            received: received,
            used: used,
        };

        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});
/**
 * 내가 판매한 공구내역
 */
router.all( "/my-sales", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 내가 판매한 공구 리스트 얻기 " );
        // 진행중
        let progressing = await Products.findAll({
            where: {
                state: 1,
                product_role: "product",
                deleted: null,
                user_id: req.body.jwt_data.id,
                // active_state: true,
            },
            include: [{
                as: "productContents",
                model: ProductContents,
                where: {
                    role: "main",
                    deleted: null,
                },
                attributes: [ 'name', 'price' ],
            },
            {
                as: "togethers",
                model: Togethers,
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            },
            {
                as: "salesHistories",
                model: SalesHistories,
                where: {
                    old_product_id: null,                 // 종료되지 않은 공구만, 즉 현재 진행중에 있는 공구에 대한 판매내역
                    deleted : null,
                },
                include: [{
                    as: "purchaseUser",
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                attributes: ['created'],
                order: [['created', 'DESC']],
                required: false,
            }],
            attributes: [ 'id', 'state', 'name', 'details', 'counts','method', 'images', 'thumbnails', 'address', 'address_detail', 'finish_date', 'delivery_date', 'ended_date' ],
        });
        // 픽업/배달중
        let delivering = await Products.findAll({
            where: {
                state: [2, 3],
                product_role: "product",
                deleted: null,
                user_id: req.body.jwt_data.id,
                // active_state: true,
            },
            include: [{
                as: "productContents",
                model: ProductContents,
                where: {
                    role: "main",
                    deleted: null,
                },
                attributes: [ 'name', 'price' ],
            },{
                as: "togethers",
                model: Togethers,
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            }, {
                as: "salesHistories",
                model: SalesHistories,
                where: {
                    old_product_id: null,                 // 종료되지 않은 공구만, 즉 현재 진행중에 있는 공구에 대한 판매내역
                    deleted : null,
                },
                include: [{
                    as: "purchaseUser",
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                attributes: ['created'],
                order: [['created', 'DESC']],
                required: false,
            }],
            attributes: [ 'id', 'state', 'name', 'details', 'counts','method', 'images', 'thumbnails', 'address', 'address_detail', 'delivery_date', 'ended_date', ],
        });

        // 종료
        let ended = await Products.findAll({
            where: {
                state: [4, 5],
                product_role: "product",
                deleted: null,
                user_id: req.body.jwt_data.id,
                // active_state: true,
            },
            include: [{
                as: "productContents",
                model: ProductContents,
                where: {
                    role: "main",
                    deleted: null,
                },
                attributes: [ 'name', 'price' ],
            }, {
                as: "togethers",
                model: Togethers,
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            }, {
                as: "angcols",
                model: Angcols,
                where: {
                    deleted: null,
                },
                include: [{
                    as: "angcolUser",                         // 앵콜외친 사용자
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                attributes: [ 'user_id', 'created' ],
                required: false,
            },],
            attributes: [ 'id', 'state', 'name', 'details', 'counts','method', 'images', 'thumbnails', 'address', 'address_detail', 'settlement_date' ],
        });
        for(var i = 0; i < ended.length ; i++)
        {
            ended[i]['dataValues'].angcols =  ended[i]['dataValues'].angcols.sort(function(a, b) {
                var t1 = new Date(a.created);
                var t2 =  new Date(b.created);
                if(t1 > t2)
                {
                    return -1;
                } 
                if(t1 < t2)
                {
                    return 1;
                }
                return 0;
            });
       }
        for(var i = 0; i < progressing.length ; i++)
        {
            progressing[i]['dataValues'].salesHistories =  progressing[i]['dataValues'].salesHistories.sort(function(a, b) {
                var t1 = new Date(a.created);
                var t2 =  new Date(b.created);
                if(t1 > t2)
                {
                    return -1;
                } 
                if(t1 < t2)
                {
                    return 1;
                }
                return 0;
            });
        }
        for(var i = 0; i < delivering.length ; i++)
        {
            delivering[i]['dataValues'].salesHistories =  delivering[i]['dataValues'].salesHistories.sort(function(a, b) {
                var t1 = new Date(a.created);
                var t2 =  new Date(b.created);
                if(t1 > t2)
                {
                    return -1;
                } 
                if(t1 < t2)
                {
                    return 1;
                }
                return 0;
            });
       }
        let temp = {
            progressing: progressing,
            delivering: delivering,
            ended: ended,
        };
        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});
/**
 * 내가 판매한 구매내역(상세포함)
 * none_method가 "none"이면 픽업/배달일자 표시안함
 * old_product_id가 null아니면 종료상태
 * old_product_id가 null인 경우 .product.state가 1이면 기간중
 */
router.all( "/my-purchase", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 내가 판매한 구매내역 " );
        let purchase = await SalesHistories.findAll({
            where: {
                user_id: req.body.jwt_data.id,
            },
            order: [['created', 'DESC']],
            // attributes: ['created', 'payment_amount', 'delivery_date', 'payment_method', 'none_method', 'product_id', 'old_product_id', 'discount', 'purchase_details' ]
        });
        for ( let k = 0; k < purchase.length; k ++ ) {
            if ( purchase[ k ].old_product_id ) {
                /**
                 * 종료후 내역
                 */
                let temp = await ProductHistories.findOne({
                    where: { id: purchase[ k ].old_product_id },
                    include: [{
                        as: 'historySaleUser',
                        model: Users,
                        where: { deleted: null, },
                        attributes: [ 'nickname', 'phone', 'address', 'address_detail', 'longitude', 'latitude' ],
                    },],
                    attributes: [ 'name', 'finish_date', 'delivery_date','method' ],
                });
                temp['dataValues'] = Object.assign( {}, temp['dataValues'], {saleUser: temp['dataValues'].historySaleUser } );
                delete temp['dataValues'].historySaleUser;
                purchase[ k ]['dataValues'] = Object.assign( {}, purchase[ k ]['dataValues'], { product: temp } );
            } else {
                /**
                 * 종료전 내역
                 */
                let temp = await Products.findOne({
                    where: {
                        id: purchase[ k ].product_id,
                        deleted: null,
                    },
                    include: [{
                        as: 'saleUser',
                        model: Users,
                        where: {
                            deleted: null,
                        },
                        attributes: [ 'nickname', 'phone', 'address', 'address_detail', 'longitude', 'latitude' ],
                    },],
                    attributes: [ 'name', 'state', 'finish_date', 'delivery_date', 'method' ],
                });
                purchase[ k ]['dataValues'] = Object.assign( {}, purchase[ k ]['dataValues'], { product: temp } );
            }
        }
        return res.status(200).json({ status: true, results: purchase } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: e.toString() } );
    }
});

/**
 * 함께해요
 *
 */
router.all( "/my-together", async ( req, res ) => {
    try {
        /**
         * 내가 올린것
         */
        let temp1 = await Products.findAll({
            where: {
                user_id: req.body.jwt_data.id,
                deleted: null,
                product_role: "together",
                active_state: true,
            },
            include: [{
                as: 'saleUser',
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'nickname', 'phone', 'address', 'address_detail', 'photo', 'thumbnail' ],
            }, {
                as: "togethers",
                model: Togethers,
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            }, {
                as: "commits",
                model: Commits,
                where: {
                    deleted: null,
                    active_state: true,
                },
                include: [{
                    as: "users",
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail', 'name', 'nickname'],
                }],
                attributes: ['id', 'user_id', 'level', 'parent_id', 'contents', 'created', 'active_state'],
                required: false,
            }],
            order: [['created', 'DESC']],
            attributes: [ 'id', 'state', 'ended_date', 'counts', 'images', 'thumbnails', 'details', 'address', 'address_detail', 'created' ],
        });
        /**
         * 내가 참여한것
         */
        let temp2 = await Products.findAll({
            where: {
                deleted: null,
                product_role: "together",
                active_state: true,
            },
            include: [{
                as: 'saleUser',
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'nickname', 'phone', 'address', 'address_detail', 'photo', 'thumbnail' ],
            }, {
                as: "togethers",
                model: Togethers,
                where: { user_id: req.body.jwt_data.id, },
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                attributes: [ 'id', 'user_id', 'created', ],
                required: true,
            }, {
                as: "commits",
                model: Commits,
                where: {
                    deleted: null,
                    active_state: true,
                },
                include: [{
                    as: "users",
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail', 'name', 'nickname'],
                }],
                attributes: ['id', 'user_id', 'level', 'parent_id', 'contents', 'created', 'active_state'],
                required: false,
            }, {
                as: "favorites",
                model: Favorites,
                where: { user_id: req.body.jwt_data.id },
                required: false,
                attributes: ['state'],
            }],
            order: [['created', 'DESC']],
            attributes: [ 'id', 'state', 'ended_date', 'counts', 'images', 'thumbnails', 'details', 'address', 'address_detail', 'created' ],
        });
        let temp = {
            participate: temp2,
            my_registration: temp1,
        };
        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
} );

/**
 * 관심중
 */
router.all( "/my-favorite-product", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 관심중 " );
        let temp = await Products.findAll({
            where: { 
                deleted: null, 
                active_state: true,
            },
            include: [{
                as: "favorites",
                model: Favorites,
                where: { 
                    user_id: req.body.jwt_data.id,
                    state: true,
                 },
                attributes: ['state'],
                required: true,
            }, {
                as: 'saleUser',
                model: Users,
                where: { deleted: null, },
                attributes: [ 'name', 'nickname', 'thumbnail'],
            }, {
                as: "productContents",
                model: ProductContents,
                where: {
                    role: "main",
                    deleted: null,
                },
                attributes: [ 'name', 'price' ],
                required: false,
            }, {
                as: "salesHistories",
                model: SalesHistories,
                where: {
                    final_ended: null,                      // 정산기간이 안된 히스토리만
                    deleted : null,
                },
                include: [{
                    as: "purchaseUser",                     // 판매된 히스토리
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                attributes: [ 'id', 'user_id', 'created', ],
                required: false,
            }, {
                as: "angcols",
                model: Angcols,
                where: { deleted: null, },
                include: [{
                    as: "angcolUser",                         // 앵콜외친 사용자
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                attributes: [ 'id', 'user_id', 'created' ],
                required: false,
            }, {
                as: "togethers",
                model: Togethers,
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                attributes: [ 'id', 'user_id', 'created', ],
                required: false,
            }, {
                as: "commits",
                model: Commits,
                where: {
                    deleted: null,
                    active_state: true,
                },
                include: [{
                    as: "users",
                    model: Users,
                    where: { deleted: null, },
                    attributes: ['photo', 'thumbnail', 'name', 'nickname'],
                }],
                attributes: ['id', 'user_id', 'level', 'parent_id', 'contents', 'created', 'active_state'],
                required: false,
            }],
            order: [['created', "DESC"]],
        });
        for(var i = 0; i < temp.length ; i++)
        {
            temp[i]['dataValues'].angcols =  temp[i]['dataValues'].angcols.sort(function(a, b) {
                var t1 = new Date(a.created);
                var t2 =  new Date(b.created);
                if(t1 > t2)
                {
                    return -1;
                } 
                if(t1 < t2)
                {
                    return 1;
                }
                return 0;
            });

            temp[i]['dataValues'].salesHistories =  temp[i]['dataValues'].salesHistories.sort(function(a, b) {
                var t1 = new Date(a.created);
                var t2 =  new Date(b.created);
                if(t1 > t2)
                {
                    return -1;
                } 
                if(t1 < t2)
                {
                    return 1;
                }
                return 0;
            });
       }
       
        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
} );

/**
 * 초대한 친구리스트
 */
router.all( "/my-invites", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, " = 초대한 친구리스트 " );

        let temp = await Invites.findAll({
            where: {
                deleted: null,
                user_id: req.body.jwt_data.id,
            },
            include: [{
                as: "invitedUser",
                model: Users,
                where: { deleted: null, },
                attributes: ['nickname', 'address', 'thumbnail' ],
            }],
            attributes: ['id', 'user_id', 'invited_user_id', 'created', 'used'],
        });
        return res.status(200).json({ status: true, results: temp } );
    } catch (e) {
        return res.status(200).json( { status: false, msg: [ e.toString() ] } );
    }
} );
/***********************************************************************************************************
 * * * * * * * * * * * * * * * * * * * * * * *     판매정산 내역    * * * * * * * * * * * * * * * * * * * * *
 ***********************************************************************************************************/
/**
 * 판매정산 내역리스트
 */
router.all( "/my-settlements", async ( req, res ) => {
    try {
        console.log(req.body.jwt_data.id, " = 판매정산 내역리스트 " );
        let date = new Date();
        let y = date.getFullYear();
        let m = date.getMonth();
        if ( req.body.month && req.body.year ) {
            y = Number( req.body.year );
            m = Number( req.body.month ) - 1;
        }
        let firstDay = new Date( y, m, 1 );
        let lastDay = new Date( y, m + 1, 0 );

        let productHistory = await ProductHistories.findAll({
            where: {
                user_id: req.body.jwt_data.id,
                settlement_date: { [Op.gte]: new Date( firstDay ).toUTCString(), [Op.lte]: new Date( lastDay ).toUTCString(), },
            },
            order: [['settlement_date', 'DESC']],
            attributes: ['id', 'user_id', 'ended_state', 'settlement_date', 'settlement_period', 'brokerage_fee', 'created', 'name', 'details'],
        });
        let total_settlement_amount = 0;
        for ( let k = 0; k < productHistory.length; k ++ ) {
            let purchases = await SalesHistories.findOne({
                where: {
                    deleted: null,
                    old_product_id: Number( productHistory[ k ].id ),
                },
                attributes: [
                    [Sequelize.fn('sum', Sequelize.col('payment_amount')), 'total_amounts'],
                    [Sequelize.fn('count', Sequelize.col('id')), 'counts'],
                    [Sequelize.fn('sum', Sequelize.col('discount')), 'discount'],
                ],
            });
            /**
             * 포인트 할인금액
             */
            let total_amounts = purchases['dataValues'].total_amounts + purchases['dataValues'].discount;
            let brokerage_fee = Math.ceil(total_amounts * productHistory[ k ].brokerage_fee / 100 );
            let card_fee = Math.ceil(total_amounts * 3 / 100 ); // 디폴트로 3%
            let add_fee = Math.ceil((brokerage_fee + card_fee) * 10 / 100 ); // fixed로 10%
            let total_fees = brokerage_fee + card_fee + add_fee;

            productHistory[ k ]['dataValues'] = Object.assign( {}, productHistory[ k ]['dataValues'], {
                sales_totals: purchases['dataValues'].counts,
                total_amounts: total_amounts,
                brokerage_fee_amounts: brokerage_fee,
                card_fee_amounts: card_fee,
                add_fee_amounts: add_fee,
                net_profit: Math.ceil( total_amounts - total_fees ),
            });
            total_settlement_amount += Math.ceil( total_amounts - total_fees );
        }
        return res.status(200).json({ status: true, results: { total_settlement_amount: total_settlement_amount, settlements: productHistory } } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] } );
    }
} );
/**
 * 판매정산 상세
 * selement_id: ProductHistories테이블의 아이디
 */
router.all( "/settlements-detail-user", async ( req, res ) => {
    try {
        console.log(req.body.jwt_data.id, " = 판매정산 상세 " );
        if ( !req.body.selement_id )
            return res.status(200).json({ status: false, msg: ['정산내역을  선택하세요']});
        let productHistory = await ProductHistories.findOne({
            where: {
                id: Number( req.body.selement_id ),
            },
            attributes: ['id', 'user_id', 'finish_date', 'ended_date', 'ended_state', 'delivery_date', 'settlement_date', 'settlement_period', 'brokerage_fee', 'created', 'name', 'details','registered']
        });
        if ( !productHistory )
            return res.status(200).json({ status: false, msg: ['존재하지 않는 레코드입니다']});
        if ( productHistory.user_id !== req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님은 자신이 올린 공구에 대해서만 이 요청을 하실수 있습니다']});

        let seller =  await Users.findOne({
            where: {
                id: Number( productHistory['dataValues'].user_id ),
            }
        });
        let purchases = await SalesHistories.findOne({
            where: {
                deleted: null,
                old_product_id: Number( req.body.selement_id ),
            },
            attributes: [
                [Sequelize.fn('sum', Sequelize.col('payment_amount')), 'total_amounts'],
                [Sequelize.fn('count', Sequelize.col('id')), 'counts'],
                [Sequelize.fn('sum', Sequelize.col('discount')), 'discount'],
            ],
        });
        /**
         * 포인트 할인금액
         */
        let total_amounts = Number(purchases['dataValues'].total_amounts); // + purchases['dataValues'].discount
        let brokerage_fee = Math.ceil(total_amounts * productHistory.brokerage_fee / 100 );
        let card_fee = Math.ceil(total_amounts * 3 / 100 ); // 디폴트로 3%
        let add_fee = Math.ceil((brokerage_fee + card_fee) * 10 / 100 ); // fixed로 10%
        let total_fees = brokerage_fee + card_fee + add_fee;

        productHistory['dataValues'] = Object.assign( {}, productHistory['dataValues'], {
            sales_totals: purchases['dataValues'].counts,
            total_amounts: total_amounts,
            discount:purchases['dataValues'].discount,
            seller:seller,
            brokerage_fee_amounts: brokerage_fee,
            card_fee_amounts: card_fee,
            add_fee_amounts: add_fee,
            net_profit: Math.ceil( total_amounts - total_fees ),
        });
        return res.status(200).json({ status: true, results: productHistory, } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] } );
    }
} );
/**
 * 판매정산 요청
 */
router.all( "/request-settlements", async ( req, res ) => {
    try {
        console.log(req.body.jwt_data.id, " = 판매정산 요청 " );
        let user = await Users.findOne({
            where: { id: req.body.jwt_data.id }
        });
        if ( user.bank_account )
            return res.status(200).json({ status: false, msg: ['고객님은 이미 정산요청을 하셨습니다']});

        if ( !req.body.bank_name || !req.body.bank_account )
            return res.status(200).json({ status: false, msg: ['필요한 입력필드들을 채우세요']});

        await Users.update({
            business_num: req.body.business_num,
            bank_name: req.body.bank_name,
            bank_account: req.body.bank_account,
            updated: new Date().toUTCString(),
        }, {
            where: {
                id: Number( req.body.jwt_data.id ),
            }
        });
        return res.status(200).json({ status: true, msg: ['고객님의 정산요청이 성공적으로 접수되었습니다'] } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] } );
    }
} );
module.exports = router;